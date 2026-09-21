import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('CrmPipelinesController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();

  const adminUser = {
    email: `f5-admin-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Admin',
    lastName: 'F5',
  };
  const travelerUser = {
    email: `f5-traveler-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Traveler',
    lastName: 'F5',
  };

  let adminToken: string;
  let travelerToken: string;

  async function register(user: typeof adminUser): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(user)
      .expect(201);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    adminToken = await register(adminUser);
    await app.get(DataSource).getRepository(User).update(
      { email: adminUser.email },
      { role: 'admin' },
    );
    travelerToken = await register(travelerUser);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control', () => {
    it('should reject travelers (403) and anonymous (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/crm/pipelines').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({ name: 'X' })
        .expect(403);
    });
  });

  describe('pipelines', () => {
    let pipelineId: string;

    it('should validate pipeline payload (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'sin nombre' })
        .expect(400);
    });

    it('should list the seeded default pipeline with stages', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const defaultPipeline = res.body.find((p: any) => p.isDefault === true);
      expect(defaultPipeline).toBeDefined();
      expect(defaultPipeline.stages.length).toBeGreaterThanOrEqual(5);
    });

    it('should create a pipeline with initial stages', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Sales ${stamp}`,
          description: 'Pipeline de prueba',
          stages: [
            { name: 'Nuevo', position: 0 },
            { name: 'En seguimiento', position: 1, color: '#F59E0B' },
            { name: 'Ganado', position: 2, color: '#10B981', isWon: true },
            { name: 'Perdido', position: 3, color: '#6B7280', isLost: true, dailyGoal: 10 },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.isDefault).toBe(false);
      expect(res.body.stages.length).toBe(4);
      expect(res.body.stages.filter((s: any) => s.isWon || s.isLost).length).toBe(2);
      pipelineId = res.body.id;
    });

    it('should get a single pipeline with ordered stages', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/pipelines/${pipelineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.name).toContain('Sales');
      expect(res.body.stages[0].position).toBe(0);
      expect(res.body.stages[3].position).toBe(3);
    });

    it('should update a pipeline', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/pipelines/${pipelineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Sales A+', isActive: false })
        .expect(200);

      expect(res.body.name).toBe('Sales A+');
      expect(res.body.isActive).toBe(false);
    });

    it('should reject deleting the default pipeline (400)', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const defaultPipeline = list.body.find((p: any) => p.isDefault === true);

      await request(app.getHttpServer())
        .delete(`/api/v1/crm/pipelines/${defaultPipeline.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('stages', () => {
    let pipelineId: string;
    let stageA: string;
    let stageB: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Board ${stamp}`,
          stages: [
            { name: 'Paso A', position: 0 },
            { name: 'Paso B', position: 1 },
          ],
        })
        .expect(201);
      pipelineId = res.body.id;
      stageA = res.body.stages[0].id;
      stageB = res.body.stages[1].id;
    });

    it('should add a stage to a pipeline', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/pipelines/${pipelineId}/stages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Paso C', color: '#EF4444' })
        .expect(201);

      expect(res.body.pipelineId).toBe(pipelineId);
      expect(res.body.name).toBe('Paso C');
      expect(res.body.position).toBe(2);
    });

    it('should update a stage (won/lost are mutually exclusive)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/stages/${stageA}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isWon: true, color: '#10B981' })
        .expect(200);

      expect(res.body.isWon).toBe(true);
    });

    it('should reorder stages', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/pipelines/${pipelineId}/stages/reorder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orders: [
            { id: stageB, position: 0 },
            { id: stageA, position: 1 },
          ],
        })
        .expect(201);

      expect(res.body[0].id).toBe(stageB);
      expect(res.body[1].id).toBe(stageA);
    });

    it('should reject reordering a stage from another pipeline (400)', async () => {
      const other = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Alien ${stamp}` })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/pipelines/${pipelineId}/stages/reorder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orders: [{ id: other.body.id, position: 0 }] })
        .expect(400);
    });
  });

  describe('board & moving contacts', () => {
    let pipelineId: string;
    let wonStageId: string;
    let lostStageId: string;
    let openStageId: string;
    let contactId: string;

    beforeAll(async () => {
      const pl = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Journey ${stamp}`,
          stages: [
            { name: 'Abierto', position: 0 },
            { name: 'Ganado', position: 1, isWon: true },
            { name: 'Perdido', position: 2, isLost: true },
          ],
        })
        .expect(201);
      pipelineId = pl.body.id;
      openStageId = pl.body.stages[0].id;
      wonStageId = pl.body.stages[1].id;
      lostStageId = pl.body.stages[2].id;

      const cb = await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: `f5-board-${stamp}@example.com`, firstName: 'Board', lastName: 'Test' })
        .expect(201);
      contactId = cb.body.id;
    });

    it('should move a contact into an open stage', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contactId}/move-stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stageId: openStageId })
        .expect(201);

      expect(res.body.stageId).toBe(openStageId);
      expect(res.body.pipelineId).toBe(pipelineId);
      expect(res.body.lifecycleStage).toBe('lead');
    });

    it('should reflect the contact on the board', async () => {
      const board = await request(app.getHttpServer())
        .get(`/api/v1/crm/pipelines/${pipelineId}/board`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const open = board.body.stages.find((s: any) => s.id === openStageId);
      expect(open.contacts.some((c: any) => c.id === contactId)).toBe(true);
    });

    it('moving to a won stage promotes lifecycle to customer', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contactId}/move-stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stageId: wonStageId })
        .expect(201);

      expect(res.body.lifecycleStage).toBe('customer');
      expect(res.body.stageId).toBe(wonStageId);
    });

    it('moving to a lost stage demotes lifecycle to inactive', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contactId}/move-stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stageId: lostStageId })
        .expect(201);

      expect(res.body.lifecycleStage).toBe('inactive');
    });

    it('should allow re-assigning a contact to a stage in another pipeline', async () => {
      const alien = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Rival ${stamp}` })
        .expect(201);
      const alias = await request(app.getHttpServer())
        .post(`/api/v1/crm/pipelines/${alien.body.id}/stages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Otra' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contactId}/move-stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stageId: alias.body.id })
        .expect(201);

      expect(res.body.stageId).toBe(alias.body.id);
      expect(res.body.pipelineId).toBe(alien.body.id);
    });

    it('should reject moving to a non-existent stage (404)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contactId}/move-stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stageId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
    });
  });

  describe('deletion', () => {
    let pipelineId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/pipelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Disposable ${stamp}`, stages: [{ name: 'Solo' }] })
        .expect(201);
      pipelineId = res.body.id;
    });

    it('should delete a stage and detach its contacts', async () => {
      const contact = await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: `f5-del-${stamp}@example.com` })
        .expect(201);
      const stageId = (await getSingleStage(app, adminToken, pipelineId)).id;

      await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contact.body.id}/move-stage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stageId })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/crm/stages/${stageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/crm/stages/${stageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const after = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contact.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(after.body.stageId).toBeNull();
    });

    it('should delete a pipeline and return 404 afterwards', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/crm/pipelines/${pipelineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/crm/pipelines/${pipelineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});

async function getSingleStage(app: INestApplication, token: string, pipelineId: string) {
  const res = await request(app.getHttpServer())
    .get(`/api/v1/crm/pipelines/${pipelineId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body.stages[0];
}