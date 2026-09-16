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

export type CompanionStatus = 'pending_verification' | 'active' | 'paused' | 'suspended';

/**
 * Companion Profile - Cultural guides and social companions
 * Principle: "presence, not transactional intimacy"
 * Companions provide: cultural guidance, language assistance, local accompaniment, social presence
 */
@Entity('companion_profiles')
export class CompanionProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Bio (multilingual)
  @Column({ type: 'text' })
  bioEs: string;

  @Column({ type: 'text' })
  bioEn: string;

  @Column({ type: 'text', nullable: true })
  bioPt: string;

  // Services offered (cultural/social focus)
  @Column({ type: 'simple-array' })
  services: string[]; // e.g., ['city-tours', 'nightlife-guide', 'translation', 'dining-companion']

  // Languages spoken
  @Column({ type: 'simple-array' })
  languagesSpoken: string[];

  // Availability
  @Column({ type: 'simple-array', nullable: true })
  availableDays: string[]; // ['monday', 'tuesday', ...]

  @Column({ nullable: true })
  availableHoursStart: string;

  @Column({ nullable: true })
  availableHoursEnd: string;

  // Pricing (per hour, stored in COP)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  hourlyRateCop: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  halfDayRateCop: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fullDayRateCop: number;

  // Verification
  @Column({ default: false })
  identityVerified: boolean;

  @Column({ default: false })
  backgroundChecked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  // Status and stats
  @Column({ type: 'varchar', default: 'pending_verification' })
  status: CompanionStatus;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  totalBookings: number;

  @Column({ default: 0 })
  totalReviews: number;

  // LGBTQ+ friendly flag
  @Column({ default: false })
  lgbtqFriendly: boolean;

  // Neighborhoods they cover
  @Column({ type: 'simple-array', nullable: true })
  neighborhoods: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
