import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type HostStatus = 'pending_verification' | 'active' | 'paused' | 'suspended';
export type HostType = 'individual' | 'business';

@Entity('host_profiles')
export class HostProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', default: 'individual' })
  hostType: HostType;

  // Business info (if applicable)
  @Column({ nullable: true })
  businessName: string;

  @Column({ nullable: true })
  taxId: string;

  // Bio (multilingual)
  @Column({ type: 'text' })
  bioEs: string;

  @Column({ type: 'text' })
  bioEn: string;

  @Column({ type: 'text', nullable: true })
  bioPt: string;

  // Languages
  @Column({ type: 'simple-array' })
  languagesSpoken: string[];

  // Verification
  @Column({ default: false })
  identityVerified: boolean;

  @Column({ default: false })
  addressVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  // Status and stats
  @Column({ type: 'varchar', default: 'pending_verification' })
  status: HostStatus;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  totalExperiences: number;

  @Column({ default: 0 })
  totalBookings: number;

  @Column({ default: 0 })
  totalReviews: number;

  // Response metrics
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  responseRate: number;

  @Column({ nullable: true })
  averageResponseTimeMinutes: number;

  // Payment info
  @Column({ nullable: true })
  bankAccountLast4: string;

  @Column({ default: false })
  payoutSetupComplete: boolean;

  // Payout/fiscal configuration (tax rules validated externally, not enforced here)
  @Column({ type: 'varchar', default: 'COP' })
  payoutCurrency: string;

  @Column({ nullable: true })
  fiscalDocumentType: string;

  @Column({ nullable: true })
  fiscalCountry: string;

  // Featured/super host status
  @Column({ default: false })
  featured: boolean;

  @Column({ default: false })
  superHost: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
