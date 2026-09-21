import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type CrmTaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type CrmTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

@Entity('crm_tasks')
export class CrmTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  assigneeId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  contactId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  segmentId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', default: 'open' })
  @Index()
  status: CrmTaskStatus;

  @Column({ type: 'varchar', default: 'medium' })
  @Index()
  priority: CrmTaskPriority;

  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}