import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type NewsCategory = 'HIGHLY_RELEVANT' | 'RELEVANT' | 'LOW_RELEVANCE' | 'IRRELEVANT' | 'FLAGGED';
export type NewsStatus = 'pending' | 'approved' | 'rejected' | 'published';

@Entity('news_articles')
export class NewsArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalTitle: string;

  @Column({ type: 'text' })
  originalContent: string;

  @Column()
  source: string;

  @Column({ nullable: true })
  sourceUrl: string;

  @Column({ type: 'timestamp' })
  publishedAt: Date;

  // AI-generated summaries
  @Column({ type: 'varchar', length: 300, nullable: true })
  summaryEs: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  summaryEn: string;

  // AI classification
  @Column({ type: 'varchar', nullable: true })
  category: NewsCategory;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence: number;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  classificationReason: string;

  // Status
  @Column({ type: 'varchar', default: 'pending' })
  status: NewsStatus;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: false })
  featured: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
