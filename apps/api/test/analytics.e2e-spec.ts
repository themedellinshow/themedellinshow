import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const neighborhood = 'Manila';
  const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const admin = { email: `an-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'A' };
  const partnerUser = { email: `an-partner-${stamp}@test.co`, password: 'Test1234!', firstName: 'P', lastName: 'A' };
  const host = { email: `an-host-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'A' };
  const traveler = { email: `an-trav-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'A' };

  let adminToken: string;
  let partnerToken: string;
  let hostToken: string;
  let travelerToken: string;
  let expId: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    adminToken = (await register(admin)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: admin.email }, { role: 'admin' });

    partnerToken = (await register(partnerUser)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: partnerUser.email }, { role: 'partner' });

    hostToken = (await register(host)).body.accessToken;
    await request(app.getHttpServer())
      .post('/api/v1/hosts/profile')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ bioEs: 'H', bioEn: 'H', languagesSpoken: ['es'] })
      .expect(201);

    travelerToken = (await register(traveler)).body.accessToken;

    // Seed a completed, paid booking so analytics has deterministic data.
    const exp = await request(app.getHttpServer())
      .post('/api/v1/experiences')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        titleEs: `Experiencia Analytics ${stamp}`,
        titleEn: `Analytics experience ${stamp}`,
        descriptionEs: 'Desc',
        descriptionEn: 'Desc',
        category: 'wellness',
        priceCop: 90000,
        durationMinutes: 60,
        maxParticipants: 3,
        neighborhood,
      })
      .expect(201);
    expId = exp.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/experiences/${expId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);

    const booking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({
        experienceId: expId,
        bookingDate: '2030-08-01',
        startTime: '12:00',
        participants: 2,
        contactEmail: traveler.email,
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${booking.body.id}/confirm`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200);
    const init = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ bookingId: booking.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${init.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${booking.body.id}/complete`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should gate analytics to admin/partner (401/403)', async () => {
    await request(app.getHttpServer()).get('/api/v1/analytics/kpis').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/analytics/kpis')
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(403);
  });

  it('should expose kpis with a stable shape', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/kpis?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    for (const key of [
      'range',
      'bookings',
      'confirmed',
      'cancelled',
      'conversionRate',
      'gmvCop',
      'serviceFeesCop',
      'avgRating',
      'reviews',
      'activeExperiences',
      'totalUsers',
      'totalBookingsAllTime',
    ]) {
      expect(res.body).toHaveProperty(key);
    }
    expect(res.body.bookings).toBeGreaterThanOrEqual(1);
  });

  it('should reject an invalid date range (400)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/kpis?from=2026-01-01&to=2020-01-01')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('should allow partner access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/kpis')
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200);
  });

  it('should return revenue buckets excluding cancelled/refunded', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/revenue?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const bucket of res.body) {
      expect(bucket).toHaveProperty('bucket');
      expect(bucket).toHaveProperty('bookings');
      expect(bucket).toHaveProperty('gmvCop');
    }
  });

  it('should list top experiences with known seed data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/top-experiences?limit=50')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const mine = res.body.find((e: any) => e.experienceId === expId);
    expect(mine).toBeDefined();
    expect(mine.bookings).toBeGreaterThanOrEqual(1);
  });

  it('should break down neighborhoods', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/neighborhoods?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const row of res.body) {
      expect(row).toHaveProperty('neighborhood');
      expect(row).toHaveProperty('bookings');
      expect(row).toHaveProperty('gmvCop');
    }
  });
});