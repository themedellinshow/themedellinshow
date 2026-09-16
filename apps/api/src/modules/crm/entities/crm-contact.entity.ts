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

export type LeadSource =
  | 'organic'
  | 'referral'
  | 'social'
  | 'ads'
  | 'concierge'
  | 'partner'
  | 'other';

export type LifecycleStage =
  | 'lead'
  | 'prospect'
  | 'customer'
  | 'repeat_customer'
  | 'inactive';

@Entity('crm_contacts')
export class CrmContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Contact info (may exist before user registers)
  @Column()
  email: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  country: string;

  @Column({ type: 'varchar', default: 'organic' })
  leadSource: LeadSource;

  @Column({ type: 'varchar', default: 'lead' })
  lifecycleStage: LifecycleStage;

  @Column({ type: 'simple-array', nullable: true })
  interests: string[];

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // Behavioural data
  @Column({ default: 0 })
  totalBookings: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  lifetimeValueCop: number;

  @Column({ type: 'timestamp', nullable: true })
  firstBookingAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastBookingAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastContactedAt: Date;

  // Marketing consent
  @Column({ default: false })
  emailOptIn: boolean;

  @Column({ default: false })
  whatsappOptIn: boolean;

  @Column({ default: false })
  smsOptIn: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
