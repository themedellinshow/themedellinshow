import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type ReferralCreditStatus = 'pending' | 'confirmed' | 'used' | 'expired' | 'voided';

/**
 * Internal wallet credit earned through referrals.
 *
 * Business rules (see docs/business-rules/payouts-and-referrals.md):
 * - 10% of the referred user's first purchase, capped at COP $100.000.
 * - Internal credit only (not withdrawable). Usable for eligible services.
 * - Confirmed only when the qualifying booking is completed and no longer
 *   subject to refund/dispute (completion + 72h).
 * - Expires 12 months after being confirmed.
 * - Suspicious redemptions stay "pending_review" until manually reviewed.
 */
@Entity('referral_credits')
@Index(['userId', 'status'])
export class ReferralCredit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referralId: string;

  @Column({ type: 'uuid' })
  redemptionId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Qualifying first purchase that generated this credit. */
  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amountCop: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  usedCop: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: ReferralCreditStatus;

  @Column({ type: 'varchar', default: 'clear' })
  riskStatus: 'clear' | 'pending_review';

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}