import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventsAndGuides1704326400000 implements MigrationInterface {
  name = 'AddEventsAndGuides1704326400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "titleEs" varchar NOT NULL,
        "titleEn" varchar NOT NULL,
        "titlePt" varchar,
        "descriptionEs" text NOT NULL,
        "descriptionEn" text NOT NULL,
        "descriptionPt" text,
        "category" varchar NOT NULL,
        "tags" text,
        "startsAt" timestamp NOT NULL,
        "endsAt" timestamp NOT NULL,
        "timezone" varchar NOT NULL DEFAULT 'America/Bogota',
        "placeId" uuid REFERENCES "places"("id"),
        "venueName" varchar,
        "address" varchar,
        "neighborhood" varchar,
        "latitude" decimal(10,7),
        "longitude" decimal(10,7),
        "ticketed" boolean NOT NULL DEFAULT false,
        "ticketUrl" varchar,
        "minPriceCop" decimal(12,2),
        "maxPriceCop" decimal(12,2),
        "coverImageUrl" varchar,
        "imageUrls" text,
        "lgbtqFriendly" boolean NOT NULL DEFAULT false,
        "familyFriendly" boolean NOT NULL DEFAULT false,
        "featured" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'draft',
        "source" varchar,
        "sourceUrl" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "guides" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar NOT NULL UNIQUE,
        "category" varchar NOT NULL,
        "titleEs" varchar NOT NULL,
        "titleEn" varchar NOT NULL,
        "titlePt" varchar,
        "summaryEs" text NOT NULL,
        "summaryEn" text NOT NULL,
        "summaryPt" text,
        "content" jsonb NOT NULL,
        "relatedPlaceIds" text,
        "relatedExperienceIds" text,
        "tags" text,
        "coverImageUrl" varchar,
        "featured" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'draft',
        "authorName" varchar,
        "publishedAt" timestamp,
        "viewCount" int NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_events_status" ON "events"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_events_starts_at" ON "events"("startsAt")`);
    await queryRunner.query(`CREATE INDEX "idx_events_category" ON "events"("category")`);
    await queryRunner.query(`CREATE INDEX "idx_events_neighborhood" ON "events"("neighborhood")`);
    await queryRunner.query(`CREATE INDEX "idx_events_geo" ON "events"("latitude","longitude")`);

    await queryRunner.query(`CREATE INDEX "idx_guides_status" ON "guides"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_guides_category" ON "guides"("category")`);
    await queryRunner.query(`CREATE INDEX "idx_guides_slug" ON "guides"("slug")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guides"`);
    await queryRunner.query(`DROP TABLE "events"`);
  }
}
