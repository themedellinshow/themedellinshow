import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmMarketingTables1705700000000 implements MigrationInterface {
  name = 'AddCrmMarketingTables1705700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_campaigns" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" text,
        "channel" character varying NOT NULL,
        "subject" character varying,
        "body" text NOT NULL,
        "providerTemplateId" character varying,
        "segmentId" uuid,
        "status" character varying NOT NULL DEFAULT 'draft',
        "scheduledAt" TIMESTAMP,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "contactCriteria" jsonb,
        "createdByUserId" uuid,
        "totalRecipients" integer NOT NULL DEFAULT 0,
        "sentCount" integer NOT NULL DEFAULT 0,
        "deliveredCount" integer NOT NULL DEFAULT 0,
        "openedCount" integer NOT NULL DEFAULT 0,
        "clickedCount" integer NOT NULL DEFAULT 0,
        "bouncedCount" integer NOT NULL DEFAULT 0,
        "failedCount" integer NOT NULL DEFAULT 0,
        "unsubscribedCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_crm_campaigns_channel" ON "crm_campaigns" ("channel")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_campaigns_status" ON "crm_campaigns" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_campaigns_segment" ON "crm_campaigns" ("segmentId")`);
    await queryRunner.query(
      `ALTER TABLE "crm_campaigns" ADD CONSTRAINT "fk_campaigns_segment" FOREIGN KEY ("segmentId") REFERENCES "crm_segments" ("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_campaigns" ADD CONSTRAINT "fk_campaigns_creator" FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "crm_campaign_recipients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "campaignId" uuid NOT NULL,
        "contactId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'queued',
        "email" character varying,
        "phone" character varying,
        "messageId" character varying,
        "sentAt" TIMESTAMP,
        "deliveredAt" TIMESTAMP,
        "openedAt" TIMESTAMP,
        "clickedAt" TIMESTAMP,
        "error" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_recipients_campaign" ON "crm_campaign_recipients" ("campaignId")`);
    await queryRunner.query(
      `ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "fk_recipients_campaign" FOREIGN KEY ("campaignId") REFERENCES "crm_campaigns" ("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "fk_recipients_contact" FOREIGN KEY ("contactId") REFERENCES "crm_contacts" ("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE "crm_automations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" text,
        "eventType" character varying NOT NULL,
        "conditions" jsonb NOT NULL DEFAULT '{"combinator":"and","conditions":[]}',
        "actions" jsonb NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "priority" integer NOT NULL DEFAULT 0,
        "cooldownMinutes" integer NOT NULL DEFAULT 0,
        "lastTriggeredAt" TIMESTAMP,
        "runCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_crm_automations_event" ON "crm_automations" ("eventType")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_automations_status" ON "crm_automations" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "crm_automation_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "automationId" uuid NOT NULL,
        "contactId" uuid,
        "eventType" character varying NOT NULL,
        "status" character varying NOT NULL,
        "result" jsonb,
        "error" text,
        "executedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_runs_automation" ON "crm_automation_runs" ("automationId")`);
    await queryRunner.query(`CREATE INDEX "idx_runs_contact" ON "crm_automation_runs" ("contactId")`);
    await queryRunner.query(
      `ALTER TABLE "crm_automation_runs" ADD CONSTRAINT "fk_runs_automation" FOREIGN KEY ("automationId") REFERENCES "crm_automations" ("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_automation_runs" ADD CONSTRAINT "fk_runs_contact" FOREIGN KEY ("contactId") REFERENCES "crm_contacts" ("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "crm_contact_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "contactId" uuid NOT NULL,
        "authorUserId" uuid,
        "body" text NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "crm_contact_notes" ADD CONSTRAINT "fk_notes_contact" FOREIGN KEY ("contactId") REFERENCES "crm_contacts" ("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_contact_notes" ADD CONSTRAINT "fk_notes_author" FOREIGN KEY ("authorUserId") REFERENCES "users" ("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "crm_contact_notes"`);
    await queryRunner.query(`DROP TABLE "crm_automation_runs"`);
    await queryRunner.query(`DROP TABLE "crm_automations"`);
    await queryRunner.query(`DROP TABLE "crm_campaign_recipients"`);
    await queryRunner.query(`DROP TABLE "crm_campaigns"`);
  }
}