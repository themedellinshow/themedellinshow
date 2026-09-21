import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayoutsWalletDisputes1766000000000 implements MigrationInterface {
  name = 'AddPayoutsWalletDisputes1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Booking dispute lifecycle ---
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "disputedAt" timestamp`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "disputeResolvedAt" timestamp`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "disputeResolution" varchar`);

    // --- Per-experience commission override (individual negotiations) ---
    await queryRunner.query(
      `ALTER TABLE "experiences" ADD COLUMN "payoutCommissionPercent" decimal(6,4)`,
    );

    // --- Host payout/fiscal setup ---
    await queryRunner.query(
      `ALTER TABLE "host_profiles" ADD COLUMN "payoutCurrency" varchar NOT NULL DEFAULT 'COP'`,
    );
    await queryRunner.query(`ALTER TABLE "host_profiles" ADD COLUMN "fiscalDocumentType" varchar`);
    await queryRunner.query(`ALTER TABLE "host_profiles" ADD COLUMN "fiscalCountry" varchar`);

    // --- Payments: credit applied at checkout ---
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "creditCop" decimal(14,2) NOT NULL DEFAULT 0`);

    // --- Payout batches (weekly payout cycles per host) ---
    await queryRunner.query(`
      CREATE TABLE "payout_batches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "hostId" uuid NOT NULL REFERENCES "users"("id"),
        "periodStart" timestamp NOT NULL,
        "periodEnd" timestamp NOT NULL,
        "totalCop" decimal(14,2) NOT NULL,
        "payoutsCount" int NOT NULL DEFAULT 0,
        "paidAt" timestamp NOT NULL DEFAULT now(),
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_payout_batches_host" ON "payout_batches"("hostId")`);

    // --- Host payout elements (one per completed booking) ---
    await queryRunner.query(`
      CREATE TABLE "host_payouts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookingId" uuid NOT NULL REFERENCES "bookings"("id"),
        "hostId" uuid NOT NULL REFERENCES "users"("id"),
        "serviceCategory" varchar NOT NULL DEFAULT 'experience',
        "commissionRate" decimal(6,4) NOT NULL,
        "grossCop" decimal(14,2) NOT NULL,
        "commissionCop" decimal(14,2) NOT NULL,
        "netCop" decimal(14,2) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "releaseAfterTs" timestamp NOT NULL,
        "availableAt" timestamp,
        "paidAt" timestamp,
        "payoutBatchId" uuid REFERENCES "payout_batches"("id"),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_host_payouts_host_status" ON "host_payouts"("hostId","status")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_host_payouts_booking" ON "host_payouts"("bookingId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_host_payouts_release" ON "host_payouts"("status","releaseAfterTs")`,
    );

    // --- Referral redemption device/risk signals ---
    await queryRunner.query(`ALTER TABLE "referral_redemptions" ADD COLUMN "redeemedAtIp" varchar`);
    await queryRunner.query(`ALTER TABLE "referral_redemptions" ADD COLUMN "redeemedAtUserAgent" varchar`);
    await queryRunner.query(
      `ALTER TABLE "referral_redemptions" ADD COLUMN "riskStatus" varchar NOT NULL DEFAULT 'clear'`,
    );

    // --- Referral credits (internal wallet) ---
    await queryRunner.query(`
      CREATE TABLE "wallet_uses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "creditId" uuid,
        "userId" uuid NOT NULL REFERENCES "users"("id"),
        "bookingId" uuid NOT NULL REFERENCES "bookings"("id"),
        "amountCop" decimal(14,2) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_wallet_uses_booking" ON "wallet_uses"("bookingId")`);
    await queryRunner.query(`CREATE INDEX "idx_wallet_uses_credit" ON "wallet_uses"("creditId")`);

    await queryRunner.query(`
      CREATE TABLE "referral_credits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "referralId" uuid NOT NULL REFERENCES "referrals"("id"),
        "redemptionId" uuid NOT NULL REFERENCES "referral_redemptions"("id"),
        "userId" uuid NOT NULL REFERENCES "users"("id"),
        "bookingId" uuid NOT NULL REFERENCES "bookings"("id"),
        "amountCop" decimal(14,2) NOT NULL,
        "usedCop" decimal(14,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'pending',
        "riskStatus" varchar NOT NULL DEFAULT 'clear',
        "confirmedAt" timestamp,
        "expiresAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_referral_credits_user_status" ON "referral_credits"("userId","status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_referral_credits_booking" ON "referral_credits"("bookingId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_credits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_uses"`);
    await queryRunner.query(`ALTER TABLE "referral_redemptions" DROP COLUMN "riskStatus"`);
    await queryRunner.query(`ALTER TABLE "referral_redemptions" DROP COLUMN "redeemedAtUserAgent"`);
    await queryRunner.query(`ALTER TABLE "referral_redemptions" DROP COLUMN "redeemedAtIp"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "host_payouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payout_batches"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "creditCop"`);
    await queryRunner.query(`ALTER TABLE "host_profiles" DROP COLUMN "fiscalCountry"`);
    await queryRunner.query(`ALTER TABLE "host_profiles" DROP COLUMN "fiscalDocumentType"`);
    await queryRunner.query(`ALTER TABLE "host_profiles" DROP COLUMN "payoutCurrency"`);
    await queryRunner.query(`ALTER TABLE "experiences" DROP COLUMN "payoutCommissionPercent"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "disputeResolution"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "disputeResolvedAt"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "disputedAt"`);
  }
}