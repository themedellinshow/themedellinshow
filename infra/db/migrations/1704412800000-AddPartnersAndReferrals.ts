import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartnersAndReferrals1704412800000 implements MigrationInterface {
  name = 'AddPartnersAndReferrals1704412800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Partners ---
    await queryRunner.query(`
      CREATE TABLE "partners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar NOT NULL UNIQUE,
        "legalName" varchar NOT NULL,
        "displayName" varchar NOT NULL,
        "partnerType" varchar NOT NULL,
        "tier" varchar NOT NULL DEFAULT 'standard',
        "status" varchar NOT NULL DEFAULT 'pending',
        "contactEmail" varchar NOT NULL,
        "contactPhone" varchar,
        "website" varchar,
        "country" varchar,
        "ownerUserId" uuid REFERENCES "users"("id"),
        "commissionPercent" decimal(5,2) NOT NULL DEFAULT 10,
        "payoutCurrency" varchar NOT NULL DEFAULT 'COP',
        "attributionCode" varchar NOT NULL UNIQUE,
        "totalBookings" int NOT NULL DEFAULT 0,
        "totalRevenueCop" decimal(14,2) NOT NULL DEFAULT 0,
        "totalCommissionCop" decimal(14,2) NOT NULL DEFAULT 0,
        "logoUrl" varchar,
        "notes" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "partner_attributions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "partnerId" uuid NOT NULL REFERENCES "partners"("id"),
        "bookingId" uuid NOT NULL REFERENCES "bookings"("id"),
        "bookingValueCop" decimal(14,2) NOT NULL,
        "commissionPercent" decimal(5,2) NOT NULL,
        "commissionCop" decimal(14,2) NOT NULL,
        "payoutStatus" varchar NOT NULL DEFAULT 'accrued',
        "paidAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_partner_attributions_partner_created"
      ON "partner_attributions"("partnerId","createdAt")
    `);
    await queryRunner.query(`CREATE INDEX "idx_partners_status" ON "partners"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_partners_type" ON "partners"("partnerType")`);

    // --- Referrals ---
    await queryRunner.query(`
      CREATE TABLE "referrals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar NOT NULL UNIQUE,
        "referrerUserId" uuid NOT NULL REFERENCES "users"("id"),
        "status" varchar NOT NULL DEFAULT 'active',
        "rewardType" varchar NOT NULL DEFAULT 'credit',
        "rewardAmountCop" decimal(12,2) NOT NULL DEFAULT 25000,
        "referrerRewardCop" decimal(12,2) NOT NULL DEFAULT 25000,
        "totalReferred" int NOT NULL DEFAULT 0,
        "totalRewarded" int NOT NULL DEFAULT 0,
        "totalRewardsCop" decimal(14,2) NOT NULL DEFAULT 0,
        "shareImageUrl" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "referral_redemptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "referralId" uuid NOT NULL REFERENCES "referrals"("id"),
        "referredUserId" uuid NOT NULL REFERENCES "users"("id"),
        "status" varchar NOT NULL DEFAULT 'pending',
        "referredRewardCop" decimal(12,2),
        "referrerRewardCop" decimal(12,2),
        "qualifyingBookingId" uuid REFERENCES "bookings"("id"),
        "rewardedAt" timestamp,
        "sourceContext" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "expiresAt" timestamp
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_referral_redemptions_referral_status"
      ON "referral_redemptions"("referralId","status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_referral_redemptions_unique_referred"
      ON "referral_redemptions"("referralId","referredUserId")
    `);
    await queryRunner.query(`CREATE INDEX "idx_referrals_user" ON "referrals"("referrerUserId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_redemptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referrals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_attributions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "partners"`);
  }
}