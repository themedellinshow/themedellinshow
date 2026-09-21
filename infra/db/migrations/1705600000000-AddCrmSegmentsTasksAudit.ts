import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmSegmentsTasksAudit1705600000000 implements MigrationInterface {
  name = 'AddCrmSegmentsTasksAudit1705600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_segments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" text,
        "filter" jsonb,
        "ownerId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_crm_segments_owner" ON "crm_segments" ("ownerId")`);

    await queryRunner.query(`
      CREATE TABLE "crm_segment_members" (
        "segmentId" uuid NOT NULL,
        "contactId" uuid NOT NULL,
        PRIMARY KEY ("segmentId", "contactId")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "crm_segment_members" ADD CONSTRAINT "fk_members_segment" FOREIGN KEY ("segmentId") REFERENCES "crm_segments" ("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_segment_members" ADD CONSTRAINT "fk_members_contact" FOREIGN KEY ("contactId") REFERENCES "crm_contacts" ("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE "crm_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assigneeId" uuid,
        "contactId" uuid,
        "segmentId" uuid,
        "title" character varying NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'open',
        "priority" character varying NOT NULL DEFAULT 'medium',
        "dueAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "createdById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_crm_tasks_assignee" ON "crm_tasks" ("assigneeId")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_tasks_contact" ON "crm_tasks" ("contactId")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_tasks_segment" ON "crm_tasks" ("segmentId")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_tasks_status" ON "crm_tasks" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_tasks_priority" ON "crm_tasks" ("priority")`);

    await queryRunner.query(`
      CREATE TABLE "crm_audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actorId" uuid,
        "action" character varying NOT NULL,
        "entityType" character varying NOT NULL,
        "entityId" uuid,
        "changes" jsonb,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_crm_audit_actor" ON "crm_audit_log" ("actorId")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_audit_entity" ON "crm_audit_log" ("entityType")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_audit_entity_id" ON "crm_audit_log" ("entityId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "crm_audit_log"`);
    await queryRunner.query(`DROP TABLE "crm_tasks"`);
    await queryRunner.query(`DROP TABLE "crm_segment_members"`);
    await queryRunner.query(`DROP TABLE "crm_segments"`);
  }
}