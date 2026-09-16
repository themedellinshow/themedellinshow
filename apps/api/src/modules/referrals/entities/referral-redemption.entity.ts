import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Referral } from './referral.entity';
import { User } from '../../users/entities/user.entity';

export type RedemptionStatus = 'pending' | 'rewarded' | 'expired' | 'voided';

/**
 * One row per referred user that redeemed a code. Moves to "rewarded"
 * once the referred user completes their first paid booking.
 */
@Entity('referral_redemptions')
@Index(['referralId', 'status'])
export class ReferralRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referralId: string;

  @ManyToOne(() => Referral)
  @JoinColumn({ name: 'referralId' })
  referral: Referral;

  @Column({ type: 'uuid' })
  referredUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referredUserId' })
  referredUser: User;

  @Column({ type: 'varchar', default: 'pending' })
  status: RedemptionStatus;

  // Credit issued to both parties once rewarded
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  referredRewardCop: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  referrerRewardCop: number;

  @Column({ type: 'uuid', nullable: true })
  qualifyingBookingId: string;

  @Column({ type: 'timestamp', nullable: true })
  rewardedAt: Date;

  @Column({ nullable: true })
  sourceContext: string; // e.g. "signup-form", "sharable-link"

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
}