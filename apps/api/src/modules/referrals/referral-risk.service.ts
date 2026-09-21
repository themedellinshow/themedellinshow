import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Equal, MoreThanOrEqual } from 'typeorm';
import { ReferralRedemption } from './entities/referral-redemption.entity';

/**
 * Minimal referral anti-fraud signals.
 *
 * Business rules (normative, see docs/business-rules/payouts-and-referrals.md):
 * - No single signal is treated as definitive proof of fraud.
 * - Anything suspicious lands in "pending_review" for manual review instead
 *   of being auto-rejected.
 */
@Injectable()
export class ReferralRiskService {
  constructor(
    @InjectRepository(ReferralRedemption)
    private redemptionRepo: Repository<ReferralRedemption>,
  ) {}

  /**
   * Returns true when device/IP signals look like referral farming:
   * - the same device+IP was already used by another account (or for another
   *   referrer's code) recently.
   */
  async evaluate(input: {
    referralId: string;
    referredUserId: string;
    ip?: string;
    userAgent?: string;
  }): Promise<'clear' | 'pending_review'> {
    const { referralId, referredUserId, ip, userAgent } = input;
    if (!ip && !userAgent) return 'clear';

    const since = new Date(Date.now() - 24 * 3600 * 1000);

    // Rule 1: same device+IP redeemed under this same referral by a DIFFERENT
    // account inside 24h (multi-account farming of a single code).
    if (ip) {
      const sameDeviceSameReferral = await this.redemptionRepo.find({
        where: {
          referralId,
          redeemedAtIp: Equal(ip),
          createdAt: MoreThanOrEqual(since),
        },
      });
      if (sameDeviceSameReferral.some((r) => r.referredUserId !== referredUserId)) {
        return 'pending_review';
      }
    }

    // Rule 2: this device+IP previously redeemed OTHER referrer codes inside
    // 24h (one person farming several referrers).
    if (ip && userAgent) {
      const seen = await this.redemptionRepo.find({
        where: {
          redeemedAtIp: Equal(ip),
          redeemedAtUserAgent: Equal(userAgent),
          createdAt: MoreThanOrEqual(since),
        },
      });
      const foreignCodes = seen.filter(
        (r) => r.referralId !== referralId && r.referredUserId === referredUserId,
      );
      if (foreignCodes.length > 0) return 'pending_review';
    }

    return 'clear';
  }
}