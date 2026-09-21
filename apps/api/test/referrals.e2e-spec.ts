import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('ReferralsController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();

  const referrer = { email: `rf-referrer-${stamp}@test.co`, password: 'Test1234!', firstName: 'R', lastName: 'F' };
  const referredUser = { email: `rf-referred-${stamp}@test.co`, password: 'Test1234!', firstName: 'B', lastName: 'F' };
  const otherUser = { email: `rf-other-${stamp}@test.co`, password: 'Test1234!', firstName: 'C', lastName: 'F' };
  const admin = { email: `rf-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'F' };
  const host = { email: `rf-host-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'F' };

  let referrerToken: string;
  let referredId: string;
  let referredToken: string;
  let otherToken: string;
  let adminToken: string;
  let hostToken: string;
  let code: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    referrerToken = (await register(referrer)).body.accessToken;
    referredToken = (await register(referredUser)).body.accessToken;
    referredId = (await app.get(DataSource).getRepository(User).findOne({ where: { email: referredUser.email } }))!.id;
    otherToken = (await register(otherUser)).body.accessToken;

    adminToken = (await register(admin)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: admin.email }, { role: 'admin' });

    hostToken = (await register(host)).body.accessToken;
    await request(app.getHttpServer())
      .post('/api/v1/hosts/profile')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ bioEs: 'H', bioEn: 'H', languagesSpoken: ['es'] })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should report no program before a code exists', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/referrals/me')
      .set('Authorization', `Bearer ${referrerToken}`)
      .expect(200);
    expect(res.body.hasProgram).toBe(false);
  });

  it('should create a referral code (idempotent)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/referrals/me')
      .set('Authorization', `Bearer ${referrerToken}`)
      .expect(201);
    expect(res.body.code).toMatch(/^HECTOR-/);
    code = res.body.code;

    const again = await request(app.getHttpServer())
      .post('/api/v1/referrals/me')
      .set('Authorization', `Bearer ${referrerToken}`)
      .expect(201);
    expect(again.body.code).toBe(code);
  });

  it('should redeem a code (pending) and guard self/duplicate/unknown', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/referrals/redeem')
      .set('Authorization', `Bearer ${referredToken}`)
      .send({ code, sourceContext: 'signup-form' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');

    await request(app.getHttpServer())
      .post('/api/v1/referrals/redeem')
      .set('Authorization', `Bearer ${referredToken}`)
      .send({ code })
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/v1/referrals/redeem')
      .set('Authorization', `Bearer ${referrerToken}`)
      .send({ code })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/referrals/redeem')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ code: 'HECTOR-NONEXIST' })
      .expect(404);
  });

  it('should accept lowercase codes and expose share text', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/referrals/redeem')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ code: code.toLowerCase() })
      .expect(201);

    const share = await request(app.getHttpServer())
      .get(`/api/v1/referrals/share?name=Ana&language=es`)
      .set('Authorization', `Bearer ${referrerToken}`)
      .expect(200);
    expect(share.body.code).toBe(code);
    expect(share.body.message).toContain(code);

    const stats = await request(app.getHttpServer())
      .get('/api/v1/referrals/me')
      .set('Authorization', `Bearer ${referrerToken}`)
      .expect(200);
    expect(stats.body.redemptions).toHaveLength(2);
    expect(stats.body.redemptions.every((r: any) => r.status === 'pending')).toBe(true);
  });

  it('should fulfill the redemption once the referred user pays their first booking', async () => {
    const exp = await request(app.getHttpServer())
      .post('/api/v1/experiences')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        titleEs: `Tour referidos ${stamp}`,
        titleEn: `Referral tour ${stamp}`,
        descriptionEs: 'Desc',
        descriptionEn: 'Desc',
        category: 'cultural',
        priceCop: 80000,
        durationMinutes: 90,
        maxParticipants: 4,
        neighborhood: 'Envigado',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/experiences/${exp.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);

    const booking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${referredToken}`)
      .send({
        experienceId: exp.body.id,
        bookingDate: '2030-07-01',
        startTime: '11:00',
        participants: 1,
        contactEmail: referredUser.email,
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${booking.body.id}/confirm`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200);

    const init = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${referredToken}`)
      .send({ bookingId: booking.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${init.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${referredToken}`)
      .expect(201);

    // payment-completed job (queue) runs the fulfillment asynchronously.
    const stats = await waitFor(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/referrals/me')
        .set('Authorization', `Bearer ${referrerToken}`)
        .expect(200);
      return res.body.totalRewarded >= 1 ? res.body : null;
    }, 8000);

    expect(stats.totalRewarded).toBe(1);
    expect(Number(stats.totalRewardsCop)).toBeGreaterThan(0);
    const rewarded = stats.redemptions.find((r: any) => r.referredUserId === referredId);
    expect(rewarded.status).toBe('rewarded');
    expect(rewarded.qualifyingBookingId).toBe(booking.body.id);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs: number, stepMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | null = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last != null) return last;
    await sleep(stepMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}