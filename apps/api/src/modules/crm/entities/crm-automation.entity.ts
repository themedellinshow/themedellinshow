import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AutomationStatus = 'active' | 'paused' | 'draft';

export interface AutomationAction {
  type: 'add_tags' | 'log_interaction' | 'create_task' | 'update_lifecycle';
  tags?: string[];
  interactionType?: string;
  interactionChannel?: string;
  subject?: string;
  content?: string;
  taskTitle?: string;
  taskPriority?: string;
  dueInDays?: number;
  lifecycleStage?: string;
}

@Entity('crm_automations')
export class CrmAutomation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  @Index()
  eventType: string;

  @Column({ type: 'jsonb', default: () => `'{"combinator":"and","conditions":[]}'` })
  conditions: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  actions: AutomationAction[];

  @Column({ type: 'varchar', default: 'active' })
  @Index()
  status: AutomationStatus;

  @Column({ default: 0 })
  priority: number;

  @Column({ default: 0 })
  cooldownMinutes: number;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggeredAt: Date | null;

  @Column({ default: 0 })
  runCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}