import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('CrmMarketingController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();

  const adminUser = {
    email: `f4-admin-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Admin',
    lastName: 'F4',
  };
  const travelerUser = {
    email: `f4-traveler-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Traveler',
    lastName: 'F4',
  };

  let adminToken: string;
  let travelerToken: string;
  let contactId: string;

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

  async function poll<T>(url: string, check: (body: T) => boolean, timeoutMs = 12000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      last = res.body;
      if (check(res.body)) return res.body;
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
    travelerToken = await register(travelerUser);

    const match = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: `f4-contact-${stamp}@example.com`,
        firstName: 'Marg',
        lastName: 'Target',
        emailOptIn: true,
        tags: [`f4-${stamp}`],
      })
      .expect(201);
    contactId = match.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control', () => {
    it('should reject travelers (403) and anonymous (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/crm/campaigns').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/crm/campaigns')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/crm/automations')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/notes`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
    });
  });

  describe('contact notes', () => {
    it('should create, list and delete a note', async () => {
      const note = await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contactId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Prefers WhatsApp contact', metadata: { source: 'F4' } })
        .expect(201);

      expect(note.body.id).toBeDefined();
      expect(note.body.body).toContain('WhatsApp');

      const notes = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(notes.body.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .delete(`/api/v1/crm/contacts/${contactId}/notes/${note.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(res.body.deleted).toBe(true));

      await request(app.getHttpServer())
        .delete(`/api/v1/crm/contacts/${contactId}/notes/${note.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('campaigns', () => {
    let campaignId: string;

    it('should validate campaign payload (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No channel' })
        .expect(400);
    });

    it('should create a campaign targeting a contact criteria', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Newsletter ${stamp}`,
          channel: 'email',
          subject: 'La movida',
          body: 'Medellín tiene la movida perfecta',
          contactCriteria: { lifecycleStage: 'lead', tags: [`f4-${stamp}`] },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('draft');
      expect(res.body.channel).toBe('email');
      campaignId = res.body.id;
    });

    it('should list campaigns', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/campaigns?status=draft')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('should update a campaign while draft', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'La movida (enviada sn)' })
        .expect(200);

      expect(res.body.subject).toContain('enviada');
    });

    it('send enqueues the campaign; recipients are fanned out via the queue', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/crm/campaigns/${campaignId}/send`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201)
        .expect((res) => expect(res.body.queued).toBe(true));

      const done = await poll<any>(`/api/v1/crm/campaigns/${campaignId}`, (b) => b.status === 'completed');
      expect(done.totalRecipients).toBe(1);
      expect(done.sentCount).toBe(1);
      expect(done.deliveredCount).toBe(1);
      expect(done.completedAt).toBeDefined();

      const rec = await request(app.getHttpServer())
        .get(`/api/v1/crm/campaigns/${campaignId}/recipients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(rec.body.items.length).toBe(1);
      expect(rec.body.items[0].contactId).toBe(contactId);
      expect(rec.body.items[0].status).toBe('sent');

      const interactions = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const sent = interactions.body.find((i: any) => i.type === 'email_sent');
      expect(sent).toBeDefined();
      expect(sent.metadata.campaignId).toBe(campaignId);
    });

    it('should reject deleting/editing a completed campaign entirely via delete', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Late edit' })
        .expect(400);

      expect(res.body.message).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/v1/crm/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/crm/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('automations', () => {
    let automationId: string;

    it('should validate automation payload (400 without actions)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad', eventType: 'manual' })
        .expect(400);
    });

    it('should create an automation with actions', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Nurture lead',
          eventType: 'manual',
          actions: [
            { type: 'add_tags', tags: ['f4-auto'] },
            {
              type: 'log_interaction',
              interactionType: 'note',
              interactionChannel: 'manual',
              subject: 'Automation',
              content: 'Nurture ran',
            },
            { type: 'create_task', taskTitle: 'Call lead', taskPriority: 'high', dueInDays: 1 },
            { type: 'update_lifecycle', lifecycleStage: 'prospect' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.eventType).toBe('manual');
      expect(res.body.actions.length).toBe(4);
      automationId = res.body.id;
    });

    it('should list and get automations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/automations?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .get(`/api/v1/crm/automations/${automationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('trigger runs the automation actions against contacts via the queue', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/crm/automations/${automationId}/trigger`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contactIds: [contactId] })
        .expect(201)
        .expect((res) => expect(res.body.queued).toBe(true));

      await poll<any>(
        `/api/v1/crm/automations/${automationId}/runs`,
        (b) => b.items.length === 1 && b.items[0].status === 'success',
      );

      const contact = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(contact.body.tags).toContain('f4-auto');
      expect(contact.body.lifecycleStage).toBe('prospect');

      const interactions = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const note = interactions.body.find((i: any) => i.type === 'note');
      expect(note).toBeDefined();
      expect(note.metadata.automationId).toBe(automationId);

      const tasks = await request(app.getHttpServer())
        .get(`/api/v1/crm/tasks?contactId=${contactId}&status=open`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(tasks.body.items.some((t: any) => t.title === 'Call lead')).toBe(true);
    });

    it('should reject triggers for paused automation later and delete it', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/crm/automations/${automationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/crm/automations/${automationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/crm/automations/${automationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should list automation runs globally', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/automation-runs?contactId=' + contactId)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.every((r: any) => r.contactId === contactId)).toBe(true);
    });
  });
});