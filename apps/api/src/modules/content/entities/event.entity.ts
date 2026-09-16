import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Place } from './place.entity';

export type EventCategory =
  | 'concert'
  | 'festival'
  | 'nightlife'
  | 'cultural'
  | 'gastronomic'
  | 'sports'
  | 'lgbtq'
  | 'community'
  | 'other';

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'past';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Multilingual
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
  category: EventCategory;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // Timing
  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  endsAt: Date;

  @Column({ default: 'America/Bogota' })
  timezone: string;

  // Location - can reference a Place or freeform
  @Column({ type: 'uuid', nullable: true })
  placeId: string;

  @ManyToOne(() => Place, { nullable: true })
  @JoinColumn({ name: 'placeId' })
  place: Place;

  @Column({ nullable: true })
  venueName: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  neighborhood: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  // Ticketing
  @Column({ default: false })
  ticketed: boolean;

  @Column({ nullable: true })
  ticketUrl: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  minPriceCop: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxPriceCop: number;

  // Media
  @Column({ nullable: true })
  coverImageUrl: string;

  @Column({ type: 'simple-array', nullable: true })
  imageUrls: string[];

  // Flags
  @Column({ default: false })
  lgbtqFriendly: boolean;

  @Column({ default: false })
  familyFriendly: boolean;

  @Column({ default: false })
  featured: boolean;

  @Column({ type: 'varchar', default: 'draft' })
  status: EventStatus;

  @Column({ nullable: true })
  source: string; // e.g. 'manual', 'partner-x', 'scrape'

  @Column({ nullable: true })
  sourceUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
