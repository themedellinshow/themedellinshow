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

export type ExperienceCategory =
  | 'cultural'
  | 'gastronomic'
  | 'nightlife'
  | 'adventure'
  | 'wellness'
  | 'lgbtq'
  | 'local-life';

export type ExperienceStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'archived';

@Entity('experiences')
export class Experience {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Multilingual content
  @Column()
  titleEs: string;

  @Column()
  titleEn: string;

  @Column({ nullable: true })
  titlePt: string;

  @Column({ type: 'text' })
  descriptionEs: string;

  @Column({ type: 'text' })
  descriptionEn: string;

  @Column({ type: 'text', nullable: true })
  descriptionPt: string;

  @Column({ type: 'varchar' })
  category: ExperienceCategory;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // Pricing (stored in COP, converted at display)
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceCop: number;

  // Individual commission negotiation: overrides the category default for host payouts
  @Column({ type: 'decimal', precision: 6, scale: 4, nullable: true })
  payoutCommissionPercent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceUsd: number;

  // Capacity and duration
  @Column()
  durationMinutes: number;

  @Column({ default: 1 })
  minParticipants: number;

  @Column()
  maxParticipants: number;

  // Location
  @Column()
  neighborhood: string;

  @Column({ nullable: true })
  meetingPointEs: string;

  @Column({ nullable: true })
  meetingPointEn: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  // Media
  @Column({ type: 'simple-array', nullable: true })
  imageUrls: string[];

  @Column({ nullable: true })
  videoUrl: string;

  // Flags
  @Column({ default: false })
  lgbtqFriendly: boolean;

  @Column({ default: false })
  accessibleFriendly: boolean;

  @Column({ default: false })
  familyFriendly: boolean;

  @Column({ default: false })
  featured: boolean;

  // Status and stats
  @Column({ type: 'varchar', default: 'draft' })
  status: ExperienceStatus;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  totalReviews: number;

  @Column({ default: 0 })
  totalBookings: number;

  // Host relationship
  @Column({ type: 'uuid' })
  hostId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'hostId' })
  host: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
