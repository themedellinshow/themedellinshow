import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('PartnersController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const slug = `partner-${stamp}`;

  const admin = { email: `pt-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'P' };
  const ownerUser = { email: `pt-owner-${stamp}@test.co`, password: 'Test1234!', firstName: 'O', lastName: 'P' };
  const otherUser = { email: `pt-other-${stamp}@test.co`, password: 'Test1234!', firstName: 'X', lastName: 'P' };
  const traveler = { email: `pt-trav-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'P' };

  let adminToken: string;
  let ownerToken: string;
  let otherToken: string;
  let travelerToken: string;
  let ownerId: string;
  let partnerId: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  const createPartnerBody = () => ({
    slug,
    legalName: 'Agencia Ejemplo SAS',
    displayName: 'Agencia Ejemplo',
    partnerType: 'agency',
    contactEmail: `contact-${stamp}@agencia.co`,
    commissionPercent: 20,
    payoutCurrency: 'COP',
    attributionCode: `PUNTO-${stamp}`,
    ownerUserId: ownerId,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    adminToken = (await register(admin)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: admin.email }, { role: 'admin' });

    ownerToken = (await register(ownerUser)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: ownerUser.email }, { role: 'partner' });
    ownerId = (await app.get(DataSource).getRepository(User).findOne({ where: { email: ownerUser.email } }))!.id;

    otherToken = (await register(otherUser)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: otherUser.email }, { role: 'partner' });

    travelerToken = (await register(traveler)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should gate creation to admin (401/403)', async () => {
    await request(app.getHttpServer()).post('/api/v1/partners').send(createPartnerBody()).expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/partners')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send(createPartnerBody())
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/partners')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createPartnerBody())
      .expect(403);
  });

  it('should validate the payload (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'x' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...createPartnerBody(), bogus: true })
      .expect(400);
  });

  it('should create a partner (pending) with defaults resolved', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPartnerBody())
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.slug).toBe(slug);
    expect(Number(res.body.commissionPercent)).toBe(20);
    partnerId = res.body.id;
  });

  it('should reject duplicate slug and duplicate attribution code (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPartnerBody())
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/v1/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...createPartnerBody(), slug: `partner-otro-${stamp}` })
      .expect(409);
  });

  it('should list partners for admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/partners?limit=50')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.map((p: any) => p.id)).toContain(partnerId);
  });

  it('should enforce owner-ship on partner details (403 for other partners)', async () => {
    const mine = await request(app.getHttpServer())
      .get(`/api/v1/partners/${partnerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(mine.body.id).toBe(partnerId);

    await request(app.getHttpServer())
      .get(`/api/v1/partners/${partnerId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('should return me/profile only for partner role', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/v1/partners/me/profile')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(mine.body.id).toBe(partnerId);

    await request(app.getHttpServer())
      .get('/api/v1/partners/me/profile')
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(403);
  });

  it('should update and activate via admin', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/partners/${partnerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayName: 'X' })
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/partners/${partnerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionPercent: 15 })
      .expect(200);
    expect(Number(updated.body.commissionPercent)).toBe(15);

    const active = await request(app.getHttpServer())
      .patch(`/api/v1/partners/${partnerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);
    expect(active.body.status).toBe('active');
  });

  it('should expose empty attributions and zeroed summary on a fresh partner', async () => {
    const attributions = await request(app.getHttpServer())
      .get(`/api/v1/partners/${partnerId}/attributions?limit=50`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(attributions.body.items).toEqual([]);

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/partners/${partnerId}/summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(summary.body).toMatchObject({ bookings: 0, revenueCop: 0, commissionCop: 0 });
  });
});