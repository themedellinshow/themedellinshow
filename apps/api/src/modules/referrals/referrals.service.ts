import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { ReferralRedemption, RedemptionStatus } from './entities/referral-redemption.entity';

@Injectable()
export class ReferralsService {
  private static readonly CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

  constructor(
    @InjectRepository(Referral)
    private referralRepo: Repository<Referral>,
    @InjectRepository(ReferralRedemption)
    private redemptionRepo: Repository<ReferralRedemption>,
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

  /** Redeem a code for the given (already registered) user. */
  async redeem(userId: string, dto: { code: string; sourceContext?: string }): Promise<ReferralRedemption> {
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

    const redemption = this.redemptionRepo.create({
      referralId: referral.id,
      referredUserId: userId,
      status: 'pending',
      sourceContext: dto.sourceContext,
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000), // 1 year
    });

    const saved = await this.redemptionRepo.save(redemption);

    referral.totalReferred += 1;
    await this.referralRepo.save(referral);

    return saved;
  }

  /**
   * Called from BookingsService after first *paid* booking of the
   * referred user closes. Rewards both sides via Hektor credit.
   */
  async fulfillOnQualifyingBooking(userId: string, bookingId: string): Promise<void> {
    const redemptions = await this.redemptionRepo.find({
      where: { referredUserId: userId, status: 'pending' },
    });
    if (!redemptions.length) return;

    for (const redemption of redemptions) {
      const referral = await this.referralRepo.findOne({ where: { id: redemption.referralId } });
      if (!referral) continue;

      redemption.status = 'rewarded';
      redemption.qualifyingBookingId = bookingId;
      redemption.rewardedAt = new Date();
      redemption.referredRewardCop = Number(referral.rewardAmountCop);
      redemption.referrerRewardCop = Number(referral.referrerRewardCop);
      await this.redemptionRepo.save(redemption);

      referral.totalRewarded += 1;
      referral.totalRewardsCop =
        Number(referral.totalRewardsCop) + Number(referral.referrerRewardCop);
      await this.referralRepo.save(referral);

      // TODO(phase-9): credit wallet / issue up to the referred user too.
      // This is the hook where wallet credit should be applied.
    }
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