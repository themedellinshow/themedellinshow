import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

export type AutomationRunStatus = 'running' | 'success' | 'failed' | 'skipped';

@Entity('crm_automation_runs')
export class CrmAutomationRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  automationId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  contactId: string;

  @Column()
  eventType: string;

  @Column({ type: 'varchar' })
  status: AutomationRunStatus;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  executedAt: Date;
}