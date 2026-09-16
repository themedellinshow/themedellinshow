import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GuideCategory =
  | 'neighborhood'
  | 'itinerary'
  | 'thematic'
  | 'safety'
  | 'transport'
  | 'lgbtq'
  | 'gastronomic'
  | 'nightlife';

export type GuideStatus = 'draft' | 'published' | 'archived';

/**
 * Curated multi-language guides authored by Héctor / editorial team.
 * Sections stored as structured JSON to allow rich content in the app.
 */
@Entity('guides')
export class Guide {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar' })
  category: GuideCategory;

  // Multilingual titles / summaries
  @Column()
  titleEs: string;

  @Column()
  titleEn: string;

  @Column({ nullable: true })
  titlePt: string;

  @Column({ type: 'text' })
  summaryEs: string;

  @Column({ type: 'text' })
  summaryEn: string;

  @Column({ type: 'text', nullable: true })
  summaryPt: string;

  /**
   * Structured content per language.
   * Shape: { es: Section[], en: Section[], pt?: Section[] }
   * Section = { type: 'heading'|'paragraph'|'list'|'place-ref'|'experience-ref', data: any }
   */
  @Column({ type: 'jsonb' })
  content: Record<string, any>;

  // Related entities
  @Column({ type: 'simple-array', nullable: true })
  relatedPlaceIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  relatedExperienceIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  coverImageUrl: string;

  @Column({ default: false })
  featured: boolean;

  @Column({ type: 'varchar', default: 'draft' })
  status: GuideStatus;

  @Column({ nullable: true })
  authorName: string;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @Column({ default: 0 })
  viewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
