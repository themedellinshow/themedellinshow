import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Experience } from '../../experiences/entities/experience.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export type ReviewStatus = 'pending_moderation' | 'approved' | 'rejected' | 'hidden';

@Entity('reviews')
@Unique(['bookingId']) // One review per booking
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relationships
  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'uuid' })
  experienceId: string;

  @ManyToOne(() => Experience)
  @JoinColumn({ name: 'experienceId' })
  experience: Experience;

  @Column({ type: 'uuid' })
  reviewerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @Column({ type: 'uuid' })
  hostId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'hostId' })
  host: User;

  // Rating (1-5)
  @Column({ type: 'smallint' })
  rating: number;

  // Review content
  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar' })
  language: 'es' | 'en' | 'pt';

  // Optional specific ratings
  @Column({ type: 'smallint', nullable: true })
  hostRating: number;

  @Column({ type: 'smallint', nullable: true })
  valueRating: number;

  @Column({ type: 'smallint', nullable: true })
  accuracyRating: number;

  // Media
  @Column({ type: 'simple-array', nullable: true })
  imageUrls: string[];

  // Moderation
  @Column({ type: 'varchar', default: 'pending_moderation' })
  status: ReviewStatus;

  @Column({ default: false })
  verified: boolean; // Verified purchase review

  @Column({ type: 'text', nullable: true })
  moderationNote: string | null;

  @Column({ type: 'timestamp', nullable: true })
  moderatedAt: Date;

  // Host response
  @Column({ type: 'text', nullable: true })
  hostResponse: string;

  @Column({ type: 'timestamp', nullable: true })
  hostRespondedAt: Date;

  // Flags
  @Column({ default: false })
  featured: boolean;

  @Column({ default: 0 })
  helpfulCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
