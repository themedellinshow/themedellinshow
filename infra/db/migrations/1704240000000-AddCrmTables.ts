import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmTables1704240000000 implements MigrationInterface {
  name = 'AddCrmTables1704240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid REFERENCES "users"("id"),
        "email" varchar NOT NULL,
        "firstName" varchar,
        "lastName" varchar,
        "phone" varchar,
        "country" varchar,
        "leadSource" varchar NOT NULL DEFAULT 'organic',
        "lifecycleStage" varchar NOT NULL DEFAULT 'lead',
        "interests" text,
        "tags" text,
        "totalBookings" int NOT NULL DEFAULT 0,
        "lifetimeValueCop" decimal(12,2) NOT NULL DEFAULT 0,
        "firstBookingAt" timestamp,
        "lastBookingAt" timestamp,
        "lastContactedAt" timestamp,
        "emailOptIn" boolean NOT NULL DEFAULT false,
        "whatsappOptIn" boolean NOT NULL DEFAULT false,
        "smsOptIn" boolean NOT NULL DEFAULT false,
        "notes" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "crm_interactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "contactId" uuid NOT NULL REFERENCES "crm_contacts"("id") ON DELETE CASCADE,
        "type" varchar NOT NULL,
        "channel" varchar NOT NULL,
        "subject" varchar,
        "content" text,
        "metadata" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "idx_crm_contacts_email" ON "crm_contacts"("email")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_contacts_lifecycle" ON "crm_contacts"("lifecycleStage")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_contacts_user" ON "crm_contacts"("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_interactions_contact" ON "crm_interactions"("contactId")`);
    await queryRunner.query(`CREATE INDEX "idx_crm_interactions_type" ON "crm_interactions"("type")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "crm_interactions"`);
    await queryRunner.query(`DROP TABLE "crm_contacts"`);
  }
}
