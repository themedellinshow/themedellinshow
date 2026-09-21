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
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';

export type HostPayoutStatus = 'pending' | 'available' | 'paid' | 'voided';

/**
 * One payout element per completed booking. Money is held "pending" until the
 * booking is completed and the 72h dispute window elapses without an open
 * dispute; it then becomes "available" and is swept weekly into payout batches.
 *
 * Business rules: see docs/business-rules/payouts-and-referrals.md
 */
@Entity('host_payouts')
@Index(['hostId', 'status'])
export class HostPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'uuid' })
  hostId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'hostId' })
  host: User;

  @Column({ type: 'varchar', default: 'experience' })
  serviceCategory: string;

  @Column({ type: 'decimal', precision: 6, scale: 4 })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  grossCop: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  commissionCop: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  netCop: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: HostPayoutStatus;

  @Column({ type: 'timestamp' })
  releaseAfterTs: Date;

  @Column({ type: 'timestamp', nullable: true })
  availableAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  payoutBatchId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}