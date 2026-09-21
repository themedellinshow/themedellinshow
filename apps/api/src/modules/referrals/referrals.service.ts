import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { ReferralRedemption } from './entities/referral-redemption.entity';
import { ReferralRiskService } from './referral-risk.service';
import { WalletService } from '../wallet/wallet.service';

/**
 * Referral program.
 *
 * Business rules (normative, see docs/business-rules/payouts-and-referrals.md):
 * - Reward = 10% of the referred user's first purchase, capped at COP $100.000.
 * - The credit is granted as PENDING and only becomes available once the
 *   qualifying purchase is completed and past the 72h refund/dispute window.
 * - Anti-fraud: suspicious redemptions stay "pending_review" for manual review.
 */
@Injectable()
export class ReferralsService {
  private static readonly CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

  constructor(
    @InjectRepository(Referral)
    private referralRepo: Repository<Referral>,
    @InjectRepository(ReferralRedemption)
    private redemptionRepo: Repository<ReferralRedemption>,
    private riskService: ReferralRiskService,
    private walletService: WalletService,
  ) {}

  /** Create or fetch the user's referral program handle. */
  async getOrCreateForUser(userId: string): Promise<Referral> {
    const existing = await this.referralRepo.findOne({ where: { referrerUserId: userId } });
    if (existing) return existing;

    const code = await this.generateUniqueCode();
    const referral = this.referralRepo.create({
      referrerUserId: userId,
      code,
      status: 'active',
    });
    return this.referralRepo.save(referral);
  }

  /**
   * Redeem a code for the given (already registered) user.
   * Captures device/IP signals and runs the anti-fraud risk check.
   */
  async redeem(
    userId: string,
    dto: { code: string; sourceContext?: string },
    ctx: { ip?: string; userAgent?: string } = {},
  ): Promise<ReferralRedemption> {
    const code = dto.code.trim().toUpperCase();

    // Nobody references themselves
    const referral = await this.referralRepo.findOne({ where: { code } });
    if (!referral) throw new NotFoundException('Referral code not found');
    if (referral.referrerUserId === userId) {
      throw new BadRequestException('You cannot redeem your own referral code');
    }
    if (referral.status !== 'active') throw new BadRequestException('Referral code is disabled');

    const already = await this.redemptionRepo.findOne({ where: { referralId: referral.id, referredUserId: userId } });
    if (already) throw new ConflictException('Referral code already redeemed by this user');

    const riskStatus = await this.riskService.evaluate({
      referralId: referral.id,
      referredUserId: userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const redemption = this.redemptionRepo.create({
      referralId: referral.id,
      referredUserId: userId,
      status: 'pending',
      sourceContext: dto.sourceContext,
      redeemedAtIp: ctx.ip,
      redeemedAtUserAgent: ctx.userAgent ? ctx.userAgent.slice(0, 255) : undefined,
      riskStatus,
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000), // 1 year
    });

    const saved = await this.redemptionRepo.save(redemption);

    referral.totalReferred += 1;
    await this.referralRepo.save(referral);

    return saved;
  }

  /**
   * Called after the first *paid* booking of the referred user closes.
   * Grants a PENDING wallet credit to the referrer: 10% of the purchase,
   * capped at REFERRAL_REWARD_CAP (default COP $100.000).
   */
  async fulfillOnQualifyingBooking(
    userId: string,
    booking: { id: string; totalCop: number },
  ): Promise<void> {
    const redemptions = await this.redemptionRepo.find({
      where: { referredUserId: userId, status: 'pending' },
    });
    if (!redemptions.length) return;

    const rate = Number(process.env.REFERRAL_REWARD_RATE ?? 0.1);
    const cap = Number(process.env.REFERRAL_REWARD_CAP ?? 100000);
    const rewardCop = Math.min(Math.round(Number(booking.totalCop) * rate), cap);

    for (const redemption of redemptions) {
      const referral = await this.referralRepo.findOne({ where: { id: redemption.referralId } });
      if (!referral) continue;

      redemption.status = 'rewarded';
      redemption.qualifyingBookingId = booking.id;
      redemption.rewardedAt = new Date();
      redemption.referredRewardCop = Number(referral.rewardAmountCop);
      redemption.referrerRewardCop = rewardCop;
      await this.redemptionRepo.save(redemption);

      referral.totalRewarded += 1;
      referral.totalRewardsCop = Number(referral.totalRewardsCop) + rewardCop;
      await this.referralRepo.save(referral);

      // Grant a PENDING credit; WalletService confirms it only after the
      // purchase is completed and past the 72h refund/dispute window.
      await this.walletService.grantPendingCredit({
        referralId: referral.id,
        redemptionId: redemption.id,
        userId: referral.referrerUserId,
        bookingId: booking.id,
        amountCop: rewardCop,
        riskStatus: redemption.riskStatus,
      });
    }
  }

  /**
   * Manual anti-fraud review: a suspicious redemption can be cleared (credit
   * becomes confirmable) or voided (credit is voided).
   */
  async reviewRedemption(redemptionId: string, decision: 'clear' | 'void'): Promise<ReferralRedemption> {
    const redemption = await this.redemptionRepo.findOne({ where: { id: redemptionId } });
    if (!redemption) throw new NotFoundException('Redemption not found');
    if (redemption.riskStatus !== 'pending_review') {
      throw new BadRequestException('Redemption is not pending review');
    }

    if (decision === 'clear') {
      redemption.riskStatus = 'clear';
      await this.walletService.clearRiskForRedemption(redemption.id);
    } else {
      redemption.status = 'voided';
      await this.walletService.voidForRedemption(redemption.id);
    }
    return this.redemptionRepo.save(redemption);
  }

  async getStats(userId: string) {
    const referral = await this.referralRepo.findOne({ where: { referrerUserId: userId } });
    if (!referral) {
      return { hasProgram: false, code: null, totalReferred: 0, totalRewarded: 0 };
    }

    const redemptions = await this.redemptionRepo.find({
      where: { referralId: referral.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      hasProgram: true,
      code: referral.code,
      status: referral.status,
      rewardType: referral.rewardType,
      rewardAmountCop: referral.rewardAmountCop,
      referrerRewardCop: referral.referrerRewardCop,
      totalReferred: referral.totalReferred,
      totalRewarded: referral.totalRewarded,
      totalRewardsCop: referral.totalRewardsCop,
      redemptions: redemptions.map((r) => ({
        id: r.id,
        referredUserId: r.referredUserId,
        status: r.status,
        riskStatus: r.riskStatus,
        qualifyingBookingId: r.qualifyingBookingId,
        createdAt: r.createdAt,
      })),
    };
  }

  async updateStatus(userId: string, status: ReferralStatus): Promise<Referral> {
    const referral = await this.getOrCreateForUser(userId);
    referral.status = status;
    return this.referralRepo.save(referral);
  }

  /** Admin helper: lookup by code. */
  async findByCode(code: string): Promise<Referral | null> {
    return this.referralRepo.findOne({ where: { code: code.trim().toUpperCase() } });
  }

  async generateUniqueCode(prefix = 'HECTOR-'): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt++) {
      let suffix = '';
      for (let i = 0; i < 6; i++) {
        suffix += ReferralsService.CODE_ALPHABET[Math.floor(Math.random() * ReferralsService.CODE_ALPHABET.length)];
      }
      const code = `${prefix}${suffix}`;
      const exists = await this.referralRepo.findOne({ where: { code } });
      if (!exists) return code;
    }
    return `${prefix}${Date.now().toString(36).toUpperCase()}`;
  }
}