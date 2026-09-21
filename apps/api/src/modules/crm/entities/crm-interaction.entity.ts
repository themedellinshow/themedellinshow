import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CrmContact } from './crm-contact.entity';

export type InteractionType =
  | 'email_sent'
  | 'email_opened'
  | 'whatsapp_sent'
  | 'whatsapp_replied'
  | 'sms_sent'
  | 'concierge_chat'
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_paid'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'review_submitted'
  | 'note';

export type InteractionChannel = 'email' | 'whatsapp' | 'sms' | 'app' | 'concierge' | 'manual';

@Entity('crm_interactions')
export class CrmInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  contactId: string;

  @ManyToOne(() => CrmContact)
  @JoinColumn({ name: 'contactId' })
  contact: CrmContact;

  @Column({ type: 'varchar' })
  type: InteractionType;

  @Column({ type: 'varchar' })
  channel: InteractionChannel;

  @Column({ nullable: true })
  subject: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
