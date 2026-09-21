import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';
import { Booking } from '../src/modules/bookings/entities/booking.entity';
import { HostPayout } from '../src/modules/payouts/entities/host-payout.entity';
import { PayoutBatch } from '../src/modules/payouts/entities/payout-batch.entity';
import { ReferralRedemption } from '../src/modules/referrals/entities/referral-redemption.entity';
import { ReferralCredit } from '../src/modules/wallet/entities/referral-credit.entity';
import { PayoutsService } from '../src/modules/payouts/payouts.service';
import { WalletService } from '../src/modules/wallet/wallet.service';

describe('Payouts-Wallet (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const priceCop = 100000;
  const maxParticipants = 6;

  const admin = { email: `pw-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'B' };
  const host = { email: `pw-host-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'H' };
  const traveler = { email: `pw-trav-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'T' };
  const traveler2 = { email: `pw-trav2-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'B' };
  const traveler3 = { email: `pw-trav3-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'C' };

  let adminToken: string;
  let hostToken: string;
  let hostUserId: string;
  let travelerToken: string;
  let traveler2Token: string;
  let traveler3Token: string;

  let expId: string;
  let hostReferralCode: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  const makeHost = async (token: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hosts/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bioEs: 'Hola', bioEn: 'Hi', languagesSpoken: ['en'] })
      .expect(201);
    return res.body.id;
  };

  const createExperience = (token: string) =>
    request(app.getHttpServer())
      .post('/api/v1/experiences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titleEs: `Paseo Payout ${stamp}`,
        titleEn: `Payout tour ${stamp}`,
        descriptionEs: 'Desc',
        descriptionEn: 'Desc',
        category: 'cultural',
        priceCop,
        durationMinutes: 120,
        maxParticipants,
        minParticipants: 1,
        neighborhood: 'Laureles',
      });

  const createBooking = async (token: string, participants = 2) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        experienceId: expId,
        bookingDate: '2030-08-15',
        startTime: '10:30',
        participants,
        contactEmail: `${token.slice(0, 8)}-${stamp}@test.co`,
        contactPhone: '+573001112233',
      })
      .expect(201);
    return res.body.id;
  };

  const pay = async (token: string, bookingId: string, creditCop?: number) => {
    const init = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send(creditCop ? { bookingId, creditCop } : { bookingId })
      .expect(201);
    if (init.body.payment.status === 'completed') return init.body.payment;
    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/payments/${init.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return confirm.body;
  };

  const complete = async (token: string, bookingId: string) => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body;
  };

  const confirmAndPayAndComplete = async (bookingId: string, hostTok: string, travTok: string, creditCop?: number) => {
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${hostTok}`)
      .expect(200);
    const payment = await pay(travTok, bookingId, creditCop);
    expect(payment.status).toBe('completed');
    const completed = await complete(hostTok, bookingId);
    expect(completed.status).toBe('completed');
    return bookingId;
  };

  const userIdOf = async (email: string) => {
    const u = await app.get(DataSource).getRepository(User).findOne({ where: { email } });
    return u!.id;
  };

  const backdateCompleted = async (bookingId: string, hoursAgo: number) => {
    await app
      .get(DataSource)
      .getRepository(Booking)
      .update({ id: bookingId }, { completedAt: new Date(Date.now() - hoursAgo * 3600 * 1000) });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    adminToken = (await register(admin)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: admin.email }, { role: 'admin' });

    hostToken = (await register(host)).body.accessToken;
    await makeHost(hostToken);
    hostUserId = await userIdOf(host.email);
    travelerToken = (await register(traveler)).body.accessToken;
    traveler2Token = (await register(traveler2)).body.accessToken;
    traveler3Token = (await register(traveler3)).body.accessToken;

    const exp = await createExperience(hostToken);
    expId = exp.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/experiences/${expId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);

    const ref = await request(app.getHttpServer())
      .post('/api/v1/referrals/me')
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(201);
    hostReferralCode = ref.body.code;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('host payouts', () => {
    it('creates a pending payout with 20% commission when a booking completes', async () => {
      const bookingId = await createBooking(travelerToken, 2);
      await confirmAndPayAndComplete(bookingId, hostToken, travelerToken);

      const payout = await app.get(DataSource).getRepository(HostPayout).findOne({ where: { bookingId } });
      expect(payout).toBeDefined();
      expect(payout!.status).toBe('pending');
      expect(Number(payout!.commissionRate)).toBe(0.2);
      expect(Number(payout!.grossCop)).toBe(priceCop * 2);
      expect(Number(payout!.commissionCop)).toBe(priceCop * 2 * 0.2);
      expect(Number(payout!.netCop)).toBe(priceCop * 2 * 0.8);
      expect(payout!.hostId).toBe(hostUserId);
      const booking = await app.get(DataSource).getRepository(Booking).findOne({ where: { id: bookingId } });
      const expectedRelease = new Date(new Date(booking!.completedAt!).getTime() + 72 * 3600 * 1000);
      expect(Math.abs(payout!.releaseAfterTs.getTime() - expectedRelease.getTime())).toBeLessThan(2000);
    });

    it('stays pending before the 72h window and becomes available afterwards', async () => {
      const payoutRepo = app.get(DataSource).getRepository(HostPayout);
      const bookingId = await createBooking(travelerToken, 1);
      await confirmAndPayAndComplete(bookingId, hostToken, travelerToken);

      await payoutRepo.update({ bookingId }, { releaseAfterTs: new Date(Date.now() + 60 * 3600 * 1000) });
      await app.get(PayoutsService).releaseEligible();
      expect((await payoutRepo.findOne({ where: { bookingId } }))!.status).toBe('pending');

      await payoutRepo.update({ bookingId }, { releaseAfterTs: new Date(Date.now() - 1000) });
      await app.get(PayoutsService).releaseEligible();
      expect((await payoutRepo.findOne({ where: { bookingId } }))!.status).toBe('available');
    });

    it('holds the payout while a dispute is open and lets it through after resolution', async () => {
      const payoutRepo = app.get(DataSource).getRepository(HostPayout);
      const bookingId = await createBooking(travelerToken, 1);
      await confirmAndPayAndComplete(bookingId, hostToken, travelerToken);
      await payoutRepo.update({ bookingId }, { releaseAfterTs: new Date(Date.now() - 5000) });

      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/dispute`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({ reason: 'No fue como se describió' })
        .expect(201);

      await app.get(PayoutsService).releaseEligible();
      expect((await payoutRepo.findOne({ where: { bookingId } }))!.status).toBe('pending');

      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/dispute/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'resolved_without_refund' })
        .expect(201);

      await app.get(PayoutsService).releaseEligible();
      expect((await payoutRepo.findOne({ where: { bookingId } }))!.status).toBe('available');
    });

    it('sweeps available balance into a weekly batch once the minimum is met', async () => {
      const payoutRepo = app.get(DataSource).getRepository(HostPayout);
      const batchRepo = app.get(DataSource).getRepository(PayoutBatch);

      const b1 = await createBooking(travelerToken, 2); // net 160.000
      const b2 = await createBooking(traveler2Token, 2); // net 160.000
      await confirmAndPayAndComplete(b1, hostToken, travelerToken);
      await confirmAndPayAndComplete(b2, hostToken, traveler2Token);
      await payoutRepo.update({ bookingId: In([b1, b2]) }, { releaseAfterTs: new Date(Date.now() - 1000) });
      await app.get(PayoutsService).releaseEligible();

      const batches = await app.get(PayoutsService).runWeeklyBatch(true);
      expect(batches).toBeGreaterThanOrEqual(1);

      const batch = await batchRepo.findOne({ where: { hostId: hostUserId } });
      expect(batch).toBeDefined();
      expect(Number(batch!.totalCop)).toBeGreaterThanOrEqual(100000);
      expect((await payoutRepo.findOne({ where: { bookingId: b1 } }))!.status).toBe('paid');
      expect((await payoutRepo.findOne({ where: { bookingId: b1 } }))!.payoutBatchId).toBe(batch!.id);
    });

    it('does not batch a host whose available balance is below the minimum (COP 100.000)', async () => {
      const tinyHost = { email: `pw-tiny-${stamp}@test.co`, password: 'Test1234!', firstName: 'Ti', lastName: 'N' };
      const tinyToken = (await register(tinyHost)).body.accessToken;
      await makeHost(tinyToken);
      const expTiny = await createExperience(tinyToken);
      await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${expTiny.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          experienceId: expTiny.body.id,
          bookingDate: '2030-08-20',
          startTime: '09:00',
          participants: 1,
          contactEmail: `tiny-${stamp}@test.co`,
          contactPhone: '+573001112233',
        })
        .expect(201);
      const bk = res.body.id;
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bk}/confirm`)
        .set('Authorization', `Bearer ${tinyToken}`)
        .expect(200);
      await pay(travelerToken, bk);
      await complete(tinyToken, bk);

      const payoutRepo = app.get(DataSource).getRepository(HostPayout);
      await payoutRepo.update({ bookingId: bk }, { releaseAfterTs: new Date(Date.now() - 1000) });
      await app.get(PayoutsService).releaseEligible();

      await app.get(PayoutsService).runWeeklyBatch(true);

      const tinyId = await userIdOf(tinyHost.email);
      const tinyLedger = await app.get(PayoutsService).getHostLedger(tinyId);
      // 1 participant → net 80.000 < 100.000 → nothing batched.
      expect(tinyLedger.balanceCop).toBe(80000);
      expect(tinyLedger.batches.length).toBe(0);
    });

    it('exposes the host ledger via GET /api/v1/payouts/me', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payouts/me')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
      expect(res.body.currency).toBe('COP');
      expect(res.body.minPayoutCop).toBe(100000);
      expect(typeof res.body.balanceCop).toBe('number');
      expect(Array.isArray(res.body.elements)).toBe(true);
      expect(Array.isArray(res.body.batches)).toBe(true);
    });
  });

  describe('referral wallet', () => {
    let redemptionId: string;
    let creditId: string;

    it('grants a pending credit of 10% of the referred user first purchase', async () => {
      const creditRepo = app.get(DataSource).getRepository(ReferralCredit);

      const redeemed = await request(app.getHttpServer())
        .post('/api/v1/referrals/redeem')
        .set('Authorization', `Bearer ${traveler2Token}`)
        .set('User-Agent', 'PayoutSpec/1.0')
        .send({ code: hostReferralCode })
        .expect(201);
      expect(redeemed.body.riskStatus).toBe('clear');
      redemptionId = redeemed.body.id;

      const bookingId = await createBooking(traveler2Token, 2); // total 220.000 → 10% = 22.000
      await confirmAndPayAndComplete(bookingId, hostToken, traveler2Token);

      await waitFor(async () => {
        const credit = await creditRepo.findOne({ where: { redemptionId } });
        return credit ? credit : null;
      }, 15000);

      const credit = await creditRepo.findOne({ where: { redemptionId } });
      creditId = credit!.id;
      expect(credit!.status).toBe('pending');
      expect(Number(credit!.amountCop)).toBe(22000);
      expect(credit!.userId).toBe(hostUserId);
      expect(credit!.riskStatus).toBe('clear');
    });

    it('confirms the credit only after completion + 72h and shows wallet balance', async () => {
      const creditRepo = app.get(DataSource).getRepository(ReferralCredit);

      await backdateCompleted((await creditRepo.findOne({ where: { id: creditId } }))!.bookingId, 60);
      await app.get(WalletService).confirmEligible();
      expect((await creditRepo.findOne({ where: { id: creditId } }))!.status).toBe('pending');

      await backdateCompleted((await creditRepo.findOne({ where: { id: creditId } }))!.bookingId, 80);
      const confirmed = await app.get(WalletService).confirmEligible();
      expect(confirmed).toBeGreaterThanOrEqual(1);

      const confirmedCredit = await creditRepo.findOne({ where: { id: creditId } });
      expect(confirmedCredit!.status).toBe('confirmed');
      expect(confirmedCredit!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 10 * 30 * 24 * 3600 * 1000);

      const wallet = await request(app.getHttpServer())
        .get('/api/v1/wallet/me')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
      expect(wallet.body.balanceCop).toBe(22000);
      expect(wallet.body.currency).toBe('COP');
      expect(wallet.body.credits[0].expiresAt).toBeDefined();
    });

    it('lets the referrer fully pay a new booking with the credit and restores it on refund', async () => {
      const creditRepo = app.get(DataSource).getRepository(ReferralCredit);

      const cheap = await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          titleEs: `Economica ${stamp}`,
          titleEn: `Cheap ${stamp}`,
          descriptionEs: 'Desc',
          descriptionEn: 'Desc',
          category: 'cultural',
          priceCop: 10000,
          durationMinutes: 60,
          maxParticipants: 4,
          minParticipants: 1,
          neighborhood: 'Laureles',
        })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${cheap.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);

      const booking = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          experienceId: cheap.body.id,
          bookingDate: '2030-09-10',
          startTime: '08:00',
          participants: 1,
          contactEmail: `cheap-${stamp}@test.co`,
          contactPhone: '+573001112233',
        })
        .expect(201);
      const bookingId = booking.body.id;

      const payment = await pay(hostToken, bookingId, Number(booking.body.totalCop)); // credit covers it fully
      expect(Number(payment.amount)).toBe(0);
      expect(payment.status).toBe('completed');

      const walletBefore = await request(app.getHttpServer())
        .get('/api/v1/wallet/me')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
      expect(walletBefore.body.balanceCop).toBe(11000);

      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const walletAfter = await request(app.getHttpServer())
        .get('/api/v1/wallet/me')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
      expect(walletAfter.body.balanceCop).toBe(22000);
      expect(Number((await creditRepo.findOne({ where: { id: creditId } }))!.usedCop)).toBe(0);
    });

    it('voids the reward credit when the qualifying purchase is refunded', async () => {
      const creditRepo = app.get(DataSource).getRepository(ReferralCredit);

      const redeemed = await request(app.getHttpServer())
        .post('/api/v1/referrals/redeem')
        .set('Authorization', `Bearer ${traveler3Token}`)
        .set('User-Agent', 'PayoutSpec/2.0')
        .send({ code: hostReferralCode })
        .expect(201);

      const bookingId = await createBooking(traveler3Token, 1); // total 110.000 → 10% = 11.000
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
      const payment = await pay(traveler3Token, bookingId);
      await complete(hostToken, bookingId);

      await waitFor(async () => {
        const credit = await creditRepo.findOne({ where: { redemptionId: redeemed.body.id } });
        return credit ? credit : null;
      }, 15000);

      await backdateCompleted(bookingId, 80);
      await app.get(WalletService).confirmEligible();

      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const credit = await creditRepo.findOne({ where: { redemptionId: redeemed.body.id } });
      expect(credit!.status).toBe('voided');
    });

    it('flags a same-device re-redemption as pending_review and lets admin clear it', async () => {
      const redemptionRepo = app.get(DataSource).getRepository(ReferralRedemption);
      const dupe = { email: `pw-dupe-${stamp}@test.co`, password: 'Test1234!', firstName: 'D', lastName: 'D' };
      const dupeToken = (await register(dupe)).body.accessToken;

      const first = await request(app.getHttpServer())
        .post('/api/v1/referrals/redeem')
        .set('Authorization', `Bearer ${dupeToken}`)
        .set('X-Forwarded-For', '203.0.113.9')
        .set('User-Agent', 'SharedDevice/1.0')
        .send({ code: hostReferralCode })
        .expect(201);
      expect(first.body.riskStatus).toBe('clear');

      const dupe2 = { email: `pw-dupe2-${stamp}@test.co`, password: 'Test1234!', firstName: 'D', lastName: 'E' };
      const dupe2Token = (await register(dupe2)).body.accessToken;
      const second = await request(app.getHttpServer())
        .post('/api/v1/referrals/redeem')
        .set('Authorization', `Bearer ${dupe2Token}`)
        .set('X-Forwarded-For', '203.0.113.9')
        .set('User-Agent', 'SharedDevice/1.0')
        .send({ code: hostReferralCode })
        .expect(201);
      expect(second.body.riskStatus).toBe('pending_review');

      const suspicious = await redemptionRepo.findOne({ where: { id: second.body.id } });
      expect(suspicious!.riskStatus).toBe('pending_review');

      await request(app.getHttpServer())
        .patch(`/api/v1/referrals/redemptions/${suspicious!.id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'clear' })
        .expect(200);

      expect((await redemptionRepo.findOne({ where: { id: suspicious!.id } }))!.riskStatus).toBe('clear');
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs: number, stepMs = 300): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | null = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last != null) return last;
    await sleep(stepMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}