import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type CampaignChannel = 'email' | 'whatsapp' | 'sms';
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'completed'
  | 'cancelled';

@Entity('crm_campaigns')
export class CrmCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  @Index()
  channel: CampaignChannel;

  @Column({ nullable: true })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ nullable: true })
  providerTemplateId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  segmentId: string;

  @Column({ type: 'varchar', default: 'draft' })
  @Index()
  status: CampaignStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  contactCriteria: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string;

  @Column({ default: 0 })
  totalRecipients: number;

  @Column({ default: 0 })
  sentCount: number;

  @Column({ default: 0 })
  deliveredCount: number;

  @Column({ default: 0 })
  openedCount: number;

  @Column({ default: 0 })
  clickedCount: number;

  @Column({ default: 0 })
  bouncedCount: number;

  @Column({ default: 0 })
  failedCount: number;

  @Column({ default: 0 })
  unsubscribedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}