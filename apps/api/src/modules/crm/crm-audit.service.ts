import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmAuditLog } from './entities/crm-audit-log.entity';

export interface AuditLogEntry {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CrmAuditService {
  constructor(
    @InjectRepository(CrmAuditLog)
    private auditRepo: Repository<CrmAuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<CrmAuditLog> {
    return this.auditRepo.save(
      this.auditRepo.create({
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes,
        metadata: entry.metadata,
      }),
    );
  }

  async list(query: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.auditRepo.createQueryBuilder('a');

    if (query.entityType) qb.andWhere('a.entityType = :entityType', { entityType: query.entityType });
    if (query.entityId) qb.andWhere('a.entityId = :entityId', { entityId: query.entityId });
    if (query.actorId) qb.andWhere('a.actorId = :actorId', { actorId: query.actorId });

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.orderBy('a.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}