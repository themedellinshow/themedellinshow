import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * A weekly payout batch: credits a host's available payout elements that met
 * the minimum threshold, grouped into a single "payment event".
 *
 * Business rules: see docs/business-rules/payouts-and-referrals.md
 */
@Entity('payout_batches')
export class PayoutBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  hostId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'hostId' })
  host: User;

  @Index()
  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  totalCop: number;

  @Column({ default: 0 })
  payoutsCount: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}