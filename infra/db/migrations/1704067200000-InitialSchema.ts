import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704067200000 implements MigrationInterface {
  name = 'InitialSchema1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL,
        "firstName" varchar NOT NULL,
        "lastName" varchar NOT NULL,
        "phone" varchar,
        "avatarUrl" varchar,
        "role" varchar NOT NULL DEFAULT 'traveler',
        "preferredLanguage" varchar NOT NULL DEFAULT 'es',
        "preferredCurrency" varchar NOT NULL DEFAULT 'COP',
        "country" varchar,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "phoneVerified" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastLoginAt" timestamp,
        "refreshToken" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Experiences table
    await queryRunner.query(`
      CREATE TABLE "experiences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "titleEs" varchar NOT NULL,
        "titleEn" varchar NOT NULL,
        "titlePt" varchar,
        "descriptionEs" text NOT NULL,
        "descriptionEn" text NOT NULL,
        "descriptionPt" text,
        "category" varchar NOT NULL,
        "tags" text,
        "priceCop" decimal(12,2) NOT NULL,
        "priceUsd" decimal(10,2),
        "durationMinutes" int NOT NULL,
        "minParticipants" int NOT NULL DEFAULT 1,
        "maxParticipants" int NOT NULL,
        "neighborhood" varchar NOT NULL,
        "meetingPointEs" varchar,
        "meetingPointEn" varchar,
        "latitude" decimal(10,7),
        "longitude" decimal(10,7),
        "imageUrls" text,
        "videoUrl" varchar,
        "lgbtqFriendly" boolean NOT NULL DEFAULT false,
        "accessibleFriendly" boolean NOT NULL DEFAULT false,
        "familyFriendly" boolean NOT NULL DEFAULT false,
        "featured" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'draft',
        "averageRating" decimal(2,1) NOT NULL DEFAULT 0,
        "totalReviews" int NOT NULL DEFAULT 0,
        "totalBookings" int NOT NULL DEFAULT 0,
        "hostId" uuid NOT NULL REFERENCES "users"("id"),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Bookings table
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookingReference" varchar NOT NULL UNIQUE,
        "travelerId" uuid NOT NULL REFERENCES "users"("id"),
        "experienceId" uuid NOT NULL REFERENCES "experiences"("id"),
        "hostId" uuid NOT NULL REFERENCES "users"("id"),
        "bookingDate" date NOT NULL,
        "startTime" time NOT NULL,
        "participants" int NOT NULL,
        "subtotalCop" decimal(12,2) NOT NULL,
        "serviceFee" decimal(12,2) NOT NULL DEFAULT 0,
        "totalCop" decimal(12,2) NOT NULL,
        "currencyPaid" varchar NOT NULL,
        "totalPaidUsd" decimal(10,2),
        "status" varchar NOT NULL DEFAULT 'pending',
        "specialRequests" text,
        "contactEmail" varchar NOT NULL,
        "contactPhone" varchar,
        "confirmedAt" timestamp,
        "paidAt" timestamp,
        "completedAt" timestamp,
        "cancelledAt" timestamp,
        "cancellationReason" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookingId" uuid NOT NULL REFERENCES "bookings"("id"),
        "userId" uuid NOT NULL REFERENCES "users"("id"),
        "amount" decimal(12,2) NOT NULL,
        "currency" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "providerPaymentId" varchar,
        "providerCustomerId" varchar,
        "status" varchar NOT NULL DEFAULT 'pending',
        "failureReason" varchar,
        "refundedAmount" decimal(12,2) NOT NULL DEFAULT 0,
        "refundReason" varchar,
        "refundedAt" timestamp,
        "providerMetadata" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Reviews table
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookingId" uuid NOT NULL UNIQUE REFERENCES "bookings"("id"),
        "experienceId" uuid NOT NULL REFERENCES "experiences"("id"),
        "reviewerId" uuid NOT NULL REFERENCES "users"("id"),
        "hostId" uuid NOT NULL REFERENCES "users"("id"),
        "rating" smallint NOT NULL,
        "content" text NOT NULL,
        "language" varchar NOT NULL,
        "hostRating" smallint,
        "valueRating" smallint,
        "accuracyRating" smallint,
        "imageUrls" text,
        "status" varchar NOT NULL DEFAULT 'pending_moderation',
        "verified" boolean NOT NULL DEFAULT false,
        "moderationNote" varchar,
        "moderatedAt" timestamp,
        "hostResponse" text,
        "hostRespondedAt" timestamp,
        "featured" boolean NOT NULL DEFAULT false,
        "helpfulCount" int NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Host profiles table
    await queryRunner.query(`
      CREATE TABLE "host_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL UNIQUE REFERENCES "users"("id"),
        "hostType" varchar NOT NULL DEFAULT 'individual',
        "businessName" varchar,
        "taxId" varchar,
        "bioEs" text NOT NULL,
        "bioEn" text NOT NULL,
        "bioPt" text,
        "languagesSpoken" text NOT NULL,
        "identityVerified" boolean NOT NULL DEFAULT false,
        "addressVerified" boolean NOT NULL DEFAULT false,
        "verifiedAt" timestamp,
        "status" varchar NOT NULL DEFAULT 'pending_verification',
        "averageRating" decimal(2,1) NOT NULL DEFAULT 0,
        "totalExperiences" int NOT NULL DEFAULT 0,
        "totalBookings" int NOT NULL DEFAULT 0,
        "totalReviews" int NOT NULL DEFAULT 0,
        "responseRate" decimal(5,2) NOT NULL DEFAULT 0,
        "averageResponseTimeMinutes" int,
        "bankAccountLast4" varchar,
        "payoutSetupComplete" boolean NOT NULL DEFAULT false,
        "featured" boolean NOT NULL DEFAULT false,
        "superHost" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Companion profiles table
    await queryRunner.query(`
      CREATE TABLE "companion_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL UNIQUE REFERENCES "users"("id"),
        "bioEs" text NOT NULL,
        "bioEn" text NOT NULL,
        "bioPt" text,
        "services" text NOT NULL,
        "languagesSpoken" text NOT NULL,
        "availableDays" text,
        "availableHoursStart" varchar,
        "availableHoursEnd" varchar,
        "hourlyRateCop" decimal(10,2) NOT NULL,
        "halfDayRateCop" decimal(10,2),
        "fullDayRateCop" decimal(10,2),
        "identityVerified" boolean NOT NULL DEFAULT false,
        "backgroundChecked" boolean NOT NULL DEFAULT false,
        "verifiedAt" timestamp,
        "status" varchar NOT NULL DEFAULT 'pending_verification',
        "averageRating" decimal(2,1) NOT NULL DEFAULT 0,
        "totalBookings" int NOT NULL DEFAULT 0,
        "totalReviews" int NOT NULL DEFAULT 0,
        "lgbtqFriendly" boolean NOT NULL DEFAULT false,
        "neighborhoods" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Places table
    await queryRunner.query(`
      CREATE TABLE "places" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nameEs" varchar NOT NULL,
        "nameEn" varchar NOT NULL,
        "descriptionEs" text NOT NULL,
        "descriptionEn" text NOT NULL,
        "category" varchar NOT NULL,
        "tags" text,
        "neighborhood" varchar NOT NULL,
        "address" varchar NOT NULL,
        "latitude" decimal(10,7) NOT NULL,
        "longitude" decimal(10,7) NOT NULL,
        "phone" varchar,
        "website" varchar,
        "instagramHandle" varchar,
        "operatingHours" jsonb,
        "priceRange" smallint,
        "imageUrls" text,
        "lgbtqFriendly" boolean NOT NULL DEFAULT false,
        "featured" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "averageRating" decimal(2,1) NOT NULL DEFAULT 0,
        "totalReviews" int NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users"("email")`);
    await queryRunner.query(`CREATE INDEX "idx_users_role" ON "users"("role")`);
    await queryRunner.query(`CREATE INDEX "idx_experiences_status" ON "experiences"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_experiences_category" ON "experiences"("category")`);
    await queryRunner.query(`CREATE INDEX "idx_experiences_host" ON "experiences"("hostId")`);
    await queryRunner.query(`CREATE INDEX "idx_bookings_traveler" ON "bookings"("travelerId")`);
    await queryRunner.query(`CREATE INDEX "idx_bookings_status" ON "bookings"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_bookings_date" ON "bookings"("bookingDate")`);
    await queryRunner.query(`CREATE INDEX "idx_reviews_experience" ON "reviews"("experienceId")`);
    await queryRunner.query(`CREATE INDEX "idx_places_category" ON "places"("category")`);
    await queryRunner.query(`CREATE INDEX "idx_places_neighborhood" ON "places"("neighborhood")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "places"`);
    await queryRunner.query(`DROP TABLE "companion_profiles"`);
    await queryRunner.query(`DROP TABLE "host_profiles"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "experiences"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
