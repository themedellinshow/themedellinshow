import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewsTable1704153600000 implements MigrationInterface {
  name = 'AddNewsTable1704153600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "news_articles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "originalTitle" varchar NOT NULL,
        "originalContent" text NOT NULL,
        "source" varchar NOT NULL,
        "sourceUrl" varchar,
        "publishedAt" timestamp NOT NULL,
        "summaryEs" varchar(300),
        "summaryEn" varchar(300),
        "category" varchar,
        "confidence" decimal(3,2),
        "tags" text,
        "classificationReason" varchar,
        "status" varchar NOT NULL DEFAULT 'pending',
        "imageUrl" varchar,
        "featured" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_news_status" ON "news_articles"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_news_category" ON "news_articles"("category")`);
    await queryRunner.query(`CREATE INDEX "idx_news_published" ON "news_articles"("publishedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "news_articles"`);
  }
}
