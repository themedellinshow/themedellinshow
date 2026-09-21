import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmAdminColumns1704500000000 implements MigrationInterface {
  name = 'AddCrmAdminColumns1704500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "company" varchar`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "jobTitle" varchar`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "timezone" varchar`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "pronouns" varchar`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "birthDate" date`);
    await queryRunner.query(
      `ALTER TABLE "crm_contacts" ADD "doNotContact" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_contacts" ADD "leadScore" int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "unsubscribedAt" timestamp`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "lastEmailOpenAt" timestamp`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" ADD "lastWhatsappReplyAt" timestamp`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "lastWhatsappReplyAt"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "lastEmailOpenAt"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "unsubscribedAt"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "leadScore"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "doNotContact"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "birthDate"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "pronouns"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "timezone"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "jobTitle"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP COLUMN "company"`);
  }
}