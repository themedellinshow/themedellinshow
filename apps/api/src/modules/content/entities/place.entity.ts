import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PlaceCategory =
  | 'restaurant'
  | 'bar'
  | 'club'
  | 'cafe'
  | 'museum'
  | 'park'
  | 'attraction'
  | 'hotel'
  | 'spa'
  | 'shopping';

@Entity('places')
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Multilingual
  @Column()
  nameEs: string;

  @Column()
  nameEn: string;

  @Column({ type: 'text' })
  descriptionEs: string;

  @Column({ type: 'text' })
  descriptionEn: string;

  @Column({ type: 'varchar' })
  category: PlaceCategory;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // Location
  @Column()
  neighborhood: string;

  @Column()
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  // Contact
  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  instagramHandle: string;

  // Hours
  @Column({ type: 'jsonb', nullable: true })
  operatingHours: Record<string, { open: string; close: string }>;

  // Price range (1-4, like $-$$$$)
  @Column({ type: 'smallint', nullable: true })
  priceRange: number;

  // Media
  @Column({ type: 'simple-array', nullable: true })
  imageUrls: string[];

  // Flags
  @Column({ default: false })
  lgbtqFriendly: boolean;

  @Column({ default: false })
  featured: boolean;

  @Column({ default: true })
  isActive: boolean;

  // Stats
  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  totalReviews: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
