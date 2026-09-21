import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('crm_audit_log')
export class CrmAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  actorId: string;

  @Column()
  action: string;

  @Column()
  @Index()
  entityType: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}