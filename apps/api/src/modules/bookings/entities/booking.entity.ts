import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Experience } from '../../experiences/entities/experience.entity';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'no_show';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  bookingReference: string;

  // Relationships
  @Column({ type: 'uuid' })
  travelerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'travelerId' })
  traveler: User;

  @Column({ type: 'uuid' })
  experienceId: string;

  @ManyToOne(() => Experience)
  @JoinColumn({ name: 'experienceId' })
  experience: Experience;

  @Column({ type: 'uuid' })
  hostId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'hostId' })
  host: User;

  // Booking details
  @Column({ type: 'date' })
  bookingDate: Date;

  @Column({ type: 'time' })
  startTime: string;

  @Column()
  participants: number;

  // Pricing at time of booking (snapshot)
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotalCop: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  serviceFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalCop: number;

  @Column({ type: 'varchar' })
  currencyPaid: 'COP' | 'USD';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalPaidUsd: number;

  // Status
  @Column({ type: 'varchar', default: 'pending' })
  status: BookingStatus;

  // Dispute lifecycle (holds payouts while open)
  @Column({ type: 'timestamp', nullable: true })
  disputedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disputeResolvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  disputeResolution: string | null;

  // Special requests
  @Column({ type: 'text', nullable: true })
  specialRequests: string;

  // Contact info at booking time
  @Column()
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  // Timestamps for lifecycle
  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancellationReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
