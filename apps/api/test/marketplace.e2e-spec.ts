import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('Marketplace (hosts & companions) (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();

  const admin = { email: `mk-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'M' };
  const hostUser = { email: `mk-host-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'M' };
  const hostUser2 = { email: `mk-host2-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'B' };
  const companionUser = { email: `mk-comp-${stamp}@test.co`, password: 'Test1234!', firstName: 'C', lastName: 'M' };
  const companionUser2 = { email: `mk-comp2-${stamp}@test.co`, password: 'Test1234!', firstName: 'C', lastName: 'B' };

  let adminToken: string;
  let hostToken: string;
  let host2Token: string;
  let companionToken: string;
  let companion2Token: string;

  let hostProfileId: string;
  let companionProfileId: string;
  let companion2ProfileId: string;

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

    hostToken = (await register(hostUser)).body.accessToken;
    host2Token = (await register(hostUser2)).body.accessToken;
    companionToken = (await register(companionUser)).body.accessToken;
    companion2Token = (await register(companionUser2)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('hosts', () => {
    it('should validate the profile payload (400) and allow anonymous? no (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/hosts/profile')
        .send({ bioEn: 'Hi' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/hosts/profile')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ bioEs: 'Hola' })
        .expect(400);
    });

    it('should create a host profile (pending_verification) and promote the role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/hosts/profile')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          bioEs: 'Anfitrión local',
          bioEn: 'Local host',
          languagesSpoken: ['es', 'en'],
          hostType: 'individual',
          businessName: 'Paseos Co',
        })
        .expect(201);

      expect(res.body.status).toBe('pending_verification');
      expect(res.body.userId).toBeDefined();
      hostProfileId = res.body.id;

      const me = await request(app.getHttpServer())
        .get('/api/v1/hosts/me/profile')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
      expect(me.body.id).toBe(hostProfileId);

      await request(app.getHttpServer())
        .post('/api/v1/hosts/profile')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ bioEs: 'Hola', bioEn: 'Hi', languagesSpoken: ['es'] })
        .expect(409);
    });

    it('should not expose pending hosts in the public list but GET /:id works', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/hosts?limit=50')
        .expect(200);
      expect(list.body.items.map((h: any) => h.id)).not.toContain(hostProfileId);

      const one = await request(app.getHttpServer()).get(`/api/v1/hosts/${hostProfileId}`).expect(200);
      expect(one.body.status).toBe('pending_verification');
    });

    it('should enforce ownership on host updates (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/hosts/${hostProfileId}`)
        .set('Authorization', `Bearer ${host2Token}`)
        .send({ bioEn: 'no' })
        .expect(403);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/hosts/${hostProfileId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ bioEn: 'Updated bio' })
        .expect(200);
      expect(res.body.bioEn).toBe('Updated bio');
    });

    it('should NOT activate on partial verification (admin)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/hosts/${hostProfileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ identity: true })
        .expect(200);
      expect(res.body.status).toBe('pending_verification');
    });

    it('should accept admin verification and become visible', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/hosts/${hostProfileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ identity: true, address: true })
        .expect(200);
      expect(res.body.status).toBe('active');
      expect(res.body.payoutSetupComplete).not.toBe(true);

      const list = await request(app.getHttpServer())
        .get('/api/v1/hosts?limit=50')
        .expect(200);
      expect(list.body.items.map((h: any) => h.id)).toContain(hostProfileId);
    });

    it('should setup payout info (host)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/hosts/me/payout')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ last4: '4242' })
        .expect(200);
      expect(res.body.payoutSetupComplete).toBe(true);
    });

    it('should let admin toggle super host and suspend', async () => {
      const sh = await request(app.getHttpServer())
        .patch(`/api/v1/hosts/${hostProfileId}/super-host`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ superHost: true })
        .expect(200);
      expect(sh.body.superHost).toBe(true);

      const sp = await request(app.getHttpServer())
        .patch(`/api/v1/hosts/${hostProfileId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paused' })
        .expect(200);
      expect(sp.body.status).toBe('paused');

      const list = await request(app.getHttpServer())
        .get('/api/v1/hosts?limit=50')
        .expect(200);
      expect(list.body.items.map((h: any) => h.id)).not.toContain(hostProfileId);
    });

    it('should reject status changes by non-admin (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/hosts/${hostProfileId}/status`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ status: 'active' })
        .expect(403);
    });
  });

  describe('companions', () => {
    it('should validate companion payload (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/companions/profile')
        .set('Authorization', `Bearer ${companionToken}`)
        .send({ bioEs: 'Hola', bioEn: 'Hi', services: ['guide'] })
        .expect(400);
    });

    it('should create a companion profile (pending_verification) promoting the role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/companions/profile')
        .set('Authorization', `Bearer ${companionToken}`)
        .send({
          bioEs: 'Acompañante',
          bioEn: 'Companion',
          services: ['guide', 'translation'],
          languagesSpoken: ['es', 'en'],
          hourlyRateCop: 50000,
          neighborhoods: ['El Poblado', 'Laureles'],
          lgbtqFriendly: true,
        })
        .expect(201);

      expect(res.body.status).toBe('pending_verification');
      companionProfileId = res.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/companions/profile')
        .set('Authorization', `Bearer ${companionToken}`)
        .send({ bioEs: 'Hola', bioEn: 'Hi', services: ['guide'], languagesSpoken: ['es'], hourlyRateCop: 10 })
        .expect(409);
    });

    it('should not appear in public companions list while pending', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/companions?limit=50')
        .expect(200);
      expect(list.body.items.map((c: any) => c.id)).not.toContain(companionProfileId);
    });

    it('should enforce companion ownership on updates', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/companions/${companionProfileId}`)
        .set('Authorization', `Bearer ${companion2Token}`)
        .send({ bioEn: 'nope' })
        .expect(403);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/companions/${companionProfileId}`)
        .set('Authorization', `Bearer ${companionToken}`)
        .send({ hourlyRateCop: 60000 })
        .expect(200);
      expect(res.body.hourlyRateCop).toBe(60000);
    });

    it('should require both identity and background to verify (admin)', async () => {
      const partial = await request(app.getHttpServer())
        .patch(`/api/v1/companions/${companionProfileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ identity: true })
        .expect(200);
      expect(partial.body.status).toBe('pending_verification');

      const full = await request(app.getHttpServer())
        .patch(`/api/v1/companions/${companionProfileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ identity: true, background: true })
        .expect(200);
      expect(full.body.status).toBe('active');

      const list = await request(app.getHttpServer())
        .get('/api/v1/companions?limit=50')
        .expect(200);
      expect(list.body.items.map((c: any) => c.id)).toContain(companionProfileId);

      const filtered = await request(app.getHttpServer())
        .get('/api/v1/companions?maxHourlyRate=55000&limit=50')
        .expect(200);
      expect(filtered.body.items.map((c: any) => c.id)).not.toContain(companionProfileId);
    });

    it('should let admin suspend a companion (status)', async () => {
      // Second companion so the first one stays active for no cross-run interference.
      const second = await request(app.getHttpServer())
        .post('/api/v1/companions/profile')
        .set('Authorization', `Bearer ${companion2Token}`)
        .send({
          bioEs: 'Otro',
          bioEn: 'Other',
          services: ['guide'],
          languagesSpoken: ['es'],
          hourlyRateCop: 40000,
        })
        .expect(201);
      companion2ProfileId = second.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/companions/${companion2ProfileId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ identity: true, background: true })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/companions/${companion2ProfileId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' })
        .expect(200);
      expect(res.body.status).toBe('suspended');
    });
  });
});