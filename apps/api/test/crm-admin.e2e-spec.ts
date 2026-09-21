import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('CrmAdminController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();

  const adminUser = {
    email: `f3-admin-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Admin',
    lastName: 'F3',
  };
  const travelerUser = {
    email: `f3-traveler-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Traveler',
    lastName: 'F3',
  };

  let adminToken: string;
  let travelerToken: string;
  let adminId: string;
  let segmentId: string;
  let taskId: string;

  async function register(user: typeof adminUser): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(user)
      .expect(201);
    return res.body.accessToken;
  }

  async function promoteToAdmin(email: string): Promise<void> {
    const ds = app.get(DataSource);
    await ds.getRepository(User).update({ email }, { role: 'admin' });
  }

  async function waitForSegmentMemberCount(
    id: string,
    expected: number,
    timeoutMs = 8000,
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/segments/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      last = res.body;
      if (res.body.memberCount === expected) return res.body;
      await new Promise((r) => setTimeout(r, 120));
    }
    return last;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    adminToken = await register(adminUser);
    await promoteToAdmin(adminUser.email);

    const ds = app.get(DataSource);
    const admin = await ds.getRepository(User).findOne({ where: { email: adminUser.email } });
    adminId = admin!.id;

    travelerToken = await register(travelerUser);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control', () => {
    it('should reject unauthenticated requests (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/crm/segments').expect(401);
      await request(app.getHttpServer()).get('/api/v1/crm/tasks').expect(401);
      await request(app.getHttpServer()).get('/api/v1/crm/audit').expect(401);
    });

    it('should reject travelers (403) on segments, tasks and audit', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/crm/segments')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/crm/tasks')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/crm/audit')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
    });
  });

  describe('segments', () => {
    it('should validate segment payload (400 on empty filter)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/segments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ filter: { leadScoreMin: 'not-a-number' } })
        .expect(400);
    });

    it('should create a segment with a dynamic filter', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/segments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Lead + email opt-in ${stamp}`,
          description: 'Hermetic segment',
          filter: {
            lifecycleStage: 'lead',
            emailOptIn: true,
            tags: [`f3-${stamp}`],
          },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain(String(stamp));
      expect(res.body.isActive).toBe(true);
      expect(res.body.filter.tags).toContain(`f3-${stamp}`);
      segmentId = res.body.id;
    });

    it('should list segments with memberCount', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/segments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      const found = res.body.items.find((s: any) => s.id === segmentId);
      expect(found).toBeDefined();
      expect(found.memberCount).toBe(0);
    });

    it('should 404 on unknown segment', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/crm/segments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it(
      'refresh evaluates the filter and fills membership via the queue',
      async () => {
        const matchEmail = `seg-match-${stamp}@example.com`;
        const noMatchEmail = `seg-nomatch-${stamp}@example.com`;

        const match = await request(app.getHttpServer())
          .post('/api/v1/crm/contacts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: matchEmail,
            firstName: 'Seg',
            lastName: 'Match',
            emailOptIn: true,
            tags: [`f3-${stamp}`],
          })
          .expect(201);

        await request(app.getHttpServer())
          .post('/api/v1/crm/contacts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: noMatchEmail,
            firstName: 'Seg',
            lastName: 'NoMatch',
            emailOptIn: false,
            tags: [`f3-${stamp}`],
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/v1/crm/segments/${segmentId}/refresh`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201)
          .expect((res) => expect(res.body.queued).toBe(true));

        const detail = await waitForSegmentMemberCount(segmentId, 1);
        expect(detail.memberCount).toBe(1);
        expect(detail.members).toContain(match.body.id);
      },
      20000,
    );

    it('should update a segment', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/segments/${segmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Renamed ${stamp}`, isActive: false })
        .expect(200);

      expect(res.body.name).toContain('Renamed');
      expect(res.body.isActive).toBe(false);
    });

    it('should delete a segment', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/crm/segments/${segmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(res.body.deleted).toBe(true));

      await request(app.getHttpServer())
        .get(`/api/v1/crm/segments/${segmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('tasks', () => {
    it('should reject tasks for travelers (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/tasks')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({ title: 'No' })
        .expect(403);
    });

    it('should validate task payload (400 without title)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'urgent' })
        .expect(400);
    });

    it('should create a task with defaults', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Follow up ${stamp}`,
          priority: 'high',
          assigneeId: adminId,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('open');
      expect(res.body.priority).toBe('high');
      expect(res.body.assigneeId).toBe(adminId);
      taskId = res.body.id;
    });

    it('should list tasks filtered by status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/tasks?status=open&assigneeId=${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.items.find((t: any) => t.id === taskId);
      expect(found).toBeDefined();
    });

    it('should 404 on unknown task', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/crm/tasks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('marking done sets completedAt; reopening clears it', async () => {
      const done = await request(app.getHttpServer())
        .patch(`/api/v1/crm/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'done' })
        .expect(200);

      expect(done.body.status).toBe('done');
      expect(done.body.completedAt).toBeDefined();

      const reopened = await request(app.getHttpServer())
        .patch(`/api/v1/crm/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'open' })
        .expect(200);

      expect(reopened.body.status).toBe('open');
      expect(reopened.body.completedAt).toBeNull();
    });

    it('should delete a task', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/crm/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(res.body.deleted).toBe(true));

      await request(app.getHttpServer())
        .get(`/api/v1/crm/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('audit log', () => {
    it('should record mutating actions with the acting user', async () => {
      const email = `audit-${stamp}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, firstName: 'Audit', lastName: 'Entry', company: 'Acme' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/audit?entityType=contact&actorId=${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThan(0);
      const entry = res.body.items.find((a: any) => a.action === 'contact.upsert');
      expect(entry).toBeDefined();
      expect(entry.actorId).toBe(adminId);
      expect(entry.changes.email).toBe(email);
    });

    it('should paginate audit entries', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/audit?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThan(0);
      expect(res.body.meta.limit).toBe(10);
    });
  });
});