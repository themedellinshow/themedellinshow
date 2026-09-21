import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { HostPayout, HostPayoutStatus } from './entities/host-payout.entity';
import { PayoutBatch } from './entities/payout-batch.entity';
import { Booking } from '../bookings/entities/booking.entity';

/**
 * Host payout ledger.
 *
 * Business rules (normative, see docs/business-rules/payouts-and-referrals.md):
 * - Commission is a variable percentage per category, default 20% (80% to host),
 *   computed over the service value after discounts and before taxes/holds.
 * - Money stays pending until the booking is completed and 72h elapse with no
 *   open dispute. An open dispute holds the payout until resolution.
 * - Payouts are weekly in batches, only when a host's available balance reaches
 *   the COP minimum; otherwise the balance keeps accumulating.
 * - No tax rules are invented: fiscal data is stored so rules can be configured
 *   later and validated with a Colombian accountant before real payouts.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  /**
   * Default commission per experience category (20% platform / 80% host).
   * Custom/individual services override via experience.payoutCommissionPercent.
   */
  private static readonly COMMISSION_RATES: Record<string, number> = {
    cultural: 0.2,
    gastronomic: 0.2,
    nightlife: 0.2,
    adventure: 0.2,
    wellness: 0.2,
    lgbtq: 0.2,
    'local-life': 0.2,
  };

  constructor(
    @InjectRepository(HostPayout)
    private payoutRepo: Repository<HostPayout>,
    @InjectRepository(PayoutBatch)
    private batchRepo: Repository<PayoutBatch>,
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
  ) {}

  private releaseHours(): number {
    const v = Number(process.env.PAYOUT_RELEASE_HOURS ?? 72);
    return Number.isFinite(v) && v >= 0 ? v : 72;
  }

  private minPayoutCop(): number {
    const v = Number(process.env.PAYOUT_MIN_COP ?? 100000);
    return Number.isFinite(v) && v >= 0 ? v : 100000;
  }

  private defaultRate(): number {
    const v = Number(process.env.PAYOUT_DEFAULT_COMMISSION ?? 0.2);
    return Number.isFinite(v) && v >= 0 ? v : 0.2;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Commission rate for a booking: per-experience override wins, then category, then default. */
  rateFor(booking: Booking): number {
    const override = booking.experience?.payoutCommissionPercent;
    if (override != null && Number.isFinite(Number(override))) {
      return Number(override);
    }
    const category = booking.experience?.category;
    if (category && PayoutsService.COMMISSION_RATES[category] != null) {
      return PayoutsService.COMMISSION_RATES[category];
    }
    return this.defaultRate();
  }

  /**
   * Opens the payout release window for a completed booking (idempotent).
   * Money is created as "pending" until completedAt + 72h.
   */
  async openReleaseWindow(booking: Booking): Promise<HostPayout> {
    if (!booking.completedAt || booking.status !== 'completed') {
      throw new Error('Payout release requires a completed booking');
    }

    const grossCop = Number(booking.subtotalCop);
    const rate = this.rateFor(booking);
    const commissionCop = this.round2(grossCop * rate);
    const netCop = this.round2(grossCop - commissionCop);
    const releaseAfterTs = new Date(
      new Date(booking.completedAt).getTime() + this.releaseHours() * 3600 * 1000,
    );

    const existing = await this.payoutRepo.findOne({ where: { bookingId: booking.id } });
    if (existing) {
      if (existing.status === 'voided') return existing;
      existing.serviceCategory = booking.experience?.category ?? 'experience';
      existing.commissionRate = rate;
      existing.grossCop = grossCop;
      existing.commissionCop = commissionCop;
      existing.netCop = netCop;
      existing.status = 'pending';
      existing.releaseAfterTs = releaseAfterTs;
      existing.availableAt = null;
      existing.paidAt = null;
      existing.payoutBatchId = null;
      return this.payoutRepo.save(existing);
    }

    const payout = this.payoutRepo.create({
      bookingId: booking.id,
      hostId: booking.hostId,
      serviceCategory: booking.experience?.category ?? 'experience',
      commissionRate: rate,
      grossCop,
      commissionCop,
      netCop,
      status: 'pending',
      releaseAfterTs,
    });
    return this.payoutRepo.save(payout);
  }

  /**
   * Moves "pending" payouts whose 72h window has elapsed into "available",
   * as long as the booking is completed and has no open dispute.
   */
  async releaseEligible(): Promise<number> {
    const now = new Date();
    const pending = await this.payoutRepo.find({
      where: { status: 'pending', releaseAfterTs: LessThanOrEqual(now) },
      order: { releaseAfterTs: 'ASC' },
    });

    let released = 0;
    for (const payout of pending) {
      const booking = await this.bookingRepo.findOne({ where: { id: payout.bookingId } });
      if (!booking || booking.status !== 'completed') continue;
      const disputing = booking.disputedAt && !booking.disputeResolvedAt;
      if (disputing) continue;

      payout.status = 'available';
      payout.availableAt = now;
      await this.payoutRepo.save(payout);
      released += 1;
    }

    if (released) this.logger.log(`Released ${released} payout element(s)`);
    return released;
  }

  /** Voids payout elements for a cancelled/refunded booking. */
  async voidForBooking(bookingId: string): Promise<number> {
    const targets = await this.payoutRepo.find({
      where: { bookingId, status: In(['pending', 'available']) },
    });
    if (!targets.length) return 0;
    await this.payoutRepo.update(
      { id: In(targets.map((t) => t.id)) },
      { status: 'voided' as HostPayoutStatus },
    );
    this.logger.log(`Voided ${targets.length} payout element(s) for booking ${bookingId}`);
    return targets.length;
  }

  /**
   * Weekly payout: groups a host's available elements into a batch if their
   * total reaches the COP minimum; otherwise balances keep accumulating.
   */
  async runWeeklyBatch(force = false, now = new Date()): Promise<number> {
    if (!force && !(await this.isBatchDue(now))) return 0;

    const rows = (await this.payoutRepo
      .createQueryBuilder('p')
      .select('p.hostId', 'hostId')
      .addSelect('SUM(p.netCop)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('p.status = :status', { status: 'available' })
      .groupBy('p.hostId')
      .getRawMany()) as { hostId: string; total: string; count: string }[];

    const min = this.minPayoutCop();
    const periodStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    let batched = 0;

    for (const row of rows) {
      const total = Number(row.total);
      if (total < min) continue;

      const batch = this.batchRepo.create({
        hostId: row.hostId,
        periodStart,
        periodEnd: now,
        totalCop: this.round2(total),
        payoutsCount: Number(row.count),
        paidAt: now,
      });
      const saved = await this.batchRepo.save(batch);

      await this.payoutRepo.update(
        { hostId: row.hostId, status: 'available' as HostPayoutStatus },
        { status: 'paid' as HostPayoutStatus, paidAt: now, payoutBatchId: saved.id },
      );
      batched += 1;
      this.logger.log(
        `Weekly payout for host ${row.hostId}: ${this.round2(total)} COP (${row.count} element(s))`,
      );
    }

    return batched;
  }

  private async isBatchDue(now: Date): Promise<boolean> {
    const periodMinutes = Number(process.env.PAYOUT_BATCH_PERIOD_MINUTES ?? 10080);
    const periodMs = (Number.isFinite(periodMinutes) && periodMinutes > 0 ? periodMinutes : 10080) * 60 * 1000;
    const last = await this.batchRepo.find({ order: { createdAt: 'DESC' }, take: 1 });
    if (!last.length) return true;
    return now.getTime() - last[0].createdAt.getTime() >= periodMs;
  }

  /** Full sweep used by the scheduler: release eligible, then weekly batch. */
  async sweep(): Promise<void> {
    await this.releaseEligible();
    await this.runWeeklyBatch();
  }

  async getHostLedger(hostId: string) {
    const [elements, batches, aggregates] = await Promise.all([
      this.payoutRepo.find({
        where: { hostId },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
      this.batchRepo.find({
        where: { hostId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.payoutRepo
        .createQueryBuilder('p')
        .select('p.status', 'status')
        .addSelect('SUM(p.netCop)', 'total')
        .where('p.hostId = :hostId', { hostId })
        .groupBy('p.status')
        .getRawMany(),
    ]);

    const totals: Record<string, number> = {};
    for (const row of aggregates as { status: string; total: string }[]) {
      totals[row.status] = Number(row.total) ?? 0;
    }

    const pendingCop = this.round2(totals.pending ?? 0);
    const availableCop = this.round2(totals.available ?? 0);
    const paidCop = this.round2(totals.paid ?? 0);

    return {
      hostId,
      balanceCop: availableCop,
      pendingCop,
      paidCop,
      lifetimeCop: this.round2(availableCop + paidCop),
      minPayoutCop: this.minPayoutCop(),
      currency: 'COP',
      elements: elements.map((p) => ({
        id: p.id,
        bookingId: p.bookingId,
        serviceCategory: p.serviceCategory,
        grossCop: Number(p.grossCop),
        commissionRate: Number(p.commissionRate),
        commissionCop: Number(p.commissionCop),
        netCop: Number(p.netCop),
        status: p.status,
        releaseAfterTs: p.releaseAfterTs,
        availableAt: p.availableAt,
        paidAt: p.paidAt,
        payoutBatchId: p.payoutBatchId,
      })),
      batches: batches.map((b) => ({
        id: b.id,
        periodStart: b.periodStart,
        periodEnd: b.periodEnd,
        totalCop: Number(b.totalCop),
        payoutsCount: b.payoutsCount,
        paidAt: b.paidAt,
      })),
    };
  }
}