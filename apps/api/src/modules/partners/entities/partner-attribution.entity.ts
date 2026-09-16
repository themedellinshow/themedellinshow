import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Partner } from './partner.entity';
import { Booking } from '../../bookings/entities/booking.entity';

/**
 * Records a single booking attributed to a partner (via link/code).
 * Enables commission calculation and analytics.
 */
@Entity('partner_attributions')
@Index(['partnerId', 'createdAt'])
export class PartnerAttribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  partnerId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;

  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  bookingValueCop: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commissionPercent: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  commissionCop: number;

  @Column({ type: 'varchar', default: 'accrued' })
  payoutStatus: 'accrued' | 'paid' | 'reversed';

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
