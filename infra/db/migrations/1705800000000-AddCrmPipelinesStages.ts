import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmPipelinesStages1705800000000 implements MigrationInterface {
  name = 'AddCrmPipelinesStages1705800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_pipelines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "entityType" character varying NOT NULL DEFAULT 'contact',
        "isDefault" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "position" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pipelines_default" ON "crm_pipelines" ("isDefault")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pipelines_active" ON "crm_pipelines" ("isActive")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_stages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "pipelineId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "color" character varying NOT NULL DEFAULT '#3B82F6',
        "position" integer NOT NULL DEFAULT 0,
        "isWon" boolean NOT NULL DEFAULT false,
        "isLost" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "dailyGoal" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stages_pipeline" ON "crm_stages" ("pipelineId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stages_active" ON "crm_stages" ("isActive")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_stages_pipeline'
        ) THEN
          ALTER TABLE "crm_stages"
            ADD CONSTRAINT "fk_stages_pipeline"
            FOREIGN KEY ("pipelineId") REFERENCES "crm_pipelines" ("id") ON DELETE CASCADE;
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      INSERT INTO "crm_pipelines" ("id", "name", "description", "entityType", "isDefault", "isActive", "position")
      SELECT gen_random_uuid(), 'Lead Pipeline', 'Funnel por defecto para captura de contactos y clientes', 'contact', true, true, 0
      WHERE NOT EXISTS (
        SELECT 1 FROM "crm_pipelines" WHERE "isDefault" = true
      )
    `);

    await queryRunner.query(`
      INSERT INTO "crm_stages" ("pipelineId", "name", "color", "position", "isWon", "isLost", "isActive")
      SELECT p."id", s.name, s.color, s.position, s.isWon, s.isLost, s.isActive
      FROM "crm_pipelines" p
      CROSS JOIN (VALUES
        ('Lead', '#3B82F6'::varchar, 0, false, false, true),
        ('Prospecto', '#F59E0B'::varchar, 1, false, false, true),
        ('Cliente', '#10B981'::varchar, 2, true, false, true),
        ('Cliente recurrente', '#10B981'::varchar, 3, true, false, true),
        ('Inactivo', '#6B7280'::varchar, 4, false, true, true)
      ) AS s(name, color, position, isWon, isLost, isActive)
      WHERE p."isDefault" = true
        AND NOT EXISTS (
          SELECT 1 FROM "crm_stages" st WHERE st."pipelineId" = p."id" AND st.name = s.name
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "crm_contacts"
        ADD COLUMN IF NOT EXISTS "pipelineId" uuid,
        ADD COLUMN IF NOT EXISTS "stageId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_contacts_pipeline" ON "crm_contacts" ("pipelineId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_contacts_stage" ON "crm_contacts" ("stageId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_contacts_pipeline'
        ) THEN
          ALTER TABLE "crm_contacts"
            ADD CONSTRAINT "fk_contacts_pipeline"
            FOREIGN KEY ("pipelineId") REFERENCES "crm_pipelines" ("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_contacts_stage'
        ) THEN
          ALTER TABLE "crm_contacts"
            ADD CONSTRAINT "fk_contacts_stage"
            FOREIGN KEY ("stageId") REFERENCES "crm_stages" ("id") ON DELETE SET NULL;
        END IF;
      END
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP CONSTRAINT IF EXISTS "fk_contacts_stage"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP CONSTRAINT IF EXISTS "fk_contacts_pipeline"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN IF EXISTS "stageId"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN IF EXISTS "pipelineId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_stages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_pipelines"`);
  }
}