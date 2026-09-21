import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PaymentProvider = 'stripe' | 'mercadopago' | 'manual';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Amount
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  // Wallet credit applied at checkout (reduces the amount actually charged)
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  creditCop: number;

  @Column({ type: 'varchar' })
  currency: 'COP' | 'USD';

  // Provider info
  @Column({ type: 'varchar' })
  provider: PaymentProvider;

  @Column({ nullable: true })
  providerPaymentId: string;

  @Column({ nullable: true })
  providerCustomerId: string;

  // Status
  @Column({ type: 'varchar', default: 'pending' })
  status: PaymentStatus;

  @Column({ nullable: true })
  failureReason: string;

  // Refund tracking
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  refundedAmount: number;

  @Column({ nullable: true })
  refundReason: string;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  providerMetadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
