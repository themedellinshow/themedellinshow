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

export type ReferralStatus = 'active' | 'disabled';
export type RewardType = 'credit' | 'discount';

/**
 * One per referrer user. Holds the shareable code and lifetime stats.
 */
@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  code: string; // e.g. "HECTOR-M32F"

  @Column({ type: 'uuid' })
  referrerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerUserId' })
  referrerUser: User;

  @Column({ type: 'varchar', default: 'active' })
  status: ReferralStatus;

  // Reward config
  @Column({ type: 'varchar', default: 'credit' })
  rewardType: RewardType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 25000 })
  rewardAmountCop: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 25000 })
  referrerRewardCop: number;

  // Aggregates (denormalized)
  @Column({ default: 0 })
  totalReferred: number;

  @Column({ default: 0 })
  totalRewarded: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalRewardsCop: number;

  @Column({ nullable: true })
  shareImageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}