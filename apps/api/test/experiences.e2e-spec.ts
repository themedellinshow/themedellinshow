import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('ExperiencesController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const title = `Tour de Milex ${stamp}`;

  const admin = { email: `xp-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'Admin', lastName: 'X' };
  const hostA = { email: `xp-host-a-${stamp}@test.co`, password: 'Test1234!', firstName: 'Host', lastName: 'A' };
  const hostB = { email: `xp-host-b-${stamp}@test.co`, password: 'Test1234!', firstName: 'Host', lastName: 'B' };
  const traveler = {
    email: `xp-traveler-${stamp}@test.co`,
    password: 'Test1234!',
    firstName: 'Trav',
    lastName: 'T',
  };

  let adminToken: string;
  let hostAToken: string;
  let hostBToken: string;
  let travelerToken: string;
  let hostAId: string;
  let experienceId: string;

  const createHostProfile = (token: string) =>
    request(app.getHttpServer())
      .post('/api/v1/hosts/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bioEs: 'Hola', bioEn: 'Hi', languagesSpoken: ['es', 'en'] });

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  const createExperienceBody = () => ({
    titleEs: title,
    titleEn: `${title} EN`,
    descriptionEs: 'Descripcion del tour',
    descriptionEn: 'Tour description',
    category: 'local-life',
    priceCop: 120000,
    durationMinutes: 180,
    maxParticipants: 10,
    neighborhood: 'El Poblado',
    tags: ['cafe', 'walking'],
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

    const hostARes = await register(hostA);
    hostAToken = hostARes.body.accessToken;
    await createHostProfile(hostAToken).expect(201);
    hostAId = (await app.get(DataSource).getRepository(User).findOneByOrFail({ email: hostA.email })).id;

    const hostBRes = await register(hostB);
    hostBToken = hostBRes.body.accessToken;
    await createHostProfile(hostBToken).expect(201);

    travelerToken = (await register(traveler)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control', () => {
    it('should reject anonymous (401) and traveler (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .send(createExperienceBody())
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send(createExperienceBody())
        .expect(403);
    });
  });

  describe('create', () => {
    it('should validate the payload (400): missing fields and unknown fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ titleEs: 'solo titulo' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ ...createExperienceBody(), status: 'active', featured: true })
        .expect(400);
    });

    it('should create an experience as draft (host)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set('Authorization', `Bearer ${hostAToken}`)
        .send(createExperienceBody())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('draft');
      expect(res.body.hostId).toBe(hostAId);
      expect(res.body.priceCop).toBe(120000);
      experienceId = res.body.id;
    });

    it('should let admin create too', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/experiences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createExperienceBody(), titleEs: `Mini ${stamp}` })
        .expect(201);
      expect(res.body.status).toBe('draft');
    });
  });

  describe('visibility', () => {
    it('should not expose a draft in the public list (search isolated)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/experiences?search=${encodeURIComponent(title)}&limit=50`)
        .expect(200);
      expect(res.body.items.map((i: any) => i.id)).not.toContain(experienceId);
    });

    it('should return any status via GET /:id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/experiences/${experienceId}`)
        .expect(200);
      expect(res.body.status).toBe('draft');
    });

    it('should expose host-owned drafts via host/mine', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/experiences/host/mine')
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(200);
      expect(res.body.map((e: any) => e.id)).toContain(experienceId);
    });
  });

  describe('admin status flow', () => {
    it('should reject status changes from non-admin (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${experienceId}/status`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ status: 'active' })
        .expect(403);
    });

    it('should let admin transition status between valid states', async () => {
      for (const s of ['pending_review', 'paused', 'active']) {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/experiences/${experienceId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: s })
          .expect(200);
        expect(res.body.status).toBe(s);
      }
    });

    it('should activate the experience via admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${experienceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);
      expect(res.body.status).toBe('active');
    });

    it('should expose the experience in the public list once active', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/experiences?search=${encodeURIComponent(title)}&limit=50`)
        .expect(200);
      expect(res.body.items.map((i: any) => i.id)).toContain(experienceId);
    });

    it('should filter by category and price range', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/experiences?category=local-life&minPrice=100000&maxPrice=200000&limit=50`)
        .expect(200);
      expect(res.body.items.map((i: any) => i.id)).toContain(experienceId);

      const none = await request(app.getHttpServer())
        .get('/api/v1/experiences?category=wellness&minPrice=1000000&maxPrice=5000000&limit=50')
        .expect(200);
      expect(none.body.items.map((i: any) => i.id)).not.toContain(experienceId);
    });
  });

  describe('ownership', () => {
    it('should reject updates by another host (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${experienceId}`)
        .set('Authorization', `Bearer ${hostBToken}`)
        .send({ priceCop: 1 })
        .expect(403);
    });

    it('should persist a valid PATCH without whitelisting (documented contract)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${experienceId}`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ bogusField: true, priceCop: 120000 })
        .expect(200);
      expect(res.body.priceCop).toBe(120000);
    });

    it('should update own experience', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/experiences/${experienceId}`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ priceCop: 95000, meetingPointEs: 'Parque Lleras' })
        .expect(200);
      expect(res.body.priceCop).toBe(95000);
      expect(res.body.meetingPointEs).toBe('Parque Lleras');
    });

    it('should reject delete by another host (403) and delete by owner', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/experiences/${experienceId}`)
        .set('Authorization', `Bearer ${hostBToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/experiences/${experienceId}`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/experiences/${experienceId}`)
        .expect(404);
    });
  });
});