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

export type PartnerType =
  | 'hotel'
  | 'hostel'
  | 'agency'
  | 'venue'
  | 'restaurant'
  | 'media'
  | 'affiliate'
  | 'other';

export type PartnerTier = 'standard' | 'preferred' | 'strategic';
export type PartnerStatus = 'pending' | 'active' | 'paused' | 'terminated';

@Entity('partners')
export class Partner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  legalName: string;

  @Column()
  displayName: string;

  @Column({ type: 'varchar' })
  partnerType: PartnerType;

  @Column({ type: 'varchar', default: 'standard' })
  tier: PartnerTier;

  @Column({ type: 'varchar', default: 'pending' })
  status: PartnerStatus;

  // Contact
  @Column()
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  country: string;

  // Optional linked account user (partner login)
  @Column({ type: 'uuid', nullable: true })
  ownerUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ownerUserId' })
  ownerUser: User;

  // Commercial terms
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
  commissionPercent: number;

  @Column({ type: 'varchar', default: 'COP' })
  payoutCurrency: 'COP' | 'USD';

  // Attribution
  @Column({ unique: true })
  attributionCode: string; // shown in URLs like ?ref=hotelx

  // Aggregates (denormalized for quick admin views)
  @Column({ default: 0 })
  totalBookings: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalRevenueCop: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCommissionCop: number;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
