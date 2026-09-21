import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('CrmController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();

  const adminUser = {
    email: `crm-admin-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Admin',
    lastName: 'Crm',
  };
  const travelerUser = {
    email: `crm-traveler-${stamp}@example.com`,
    password: 'Test1234!',
    firstName: 'Traveler',
    lastName: 'Crm',
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control', () => {
    it('should reject travelers (403) on CRM endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
    });

    it('should reject unauthenticated requests (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/crm/contacts').expect(401);
    });
  });

  describe('upsert + validation', () => {
    it('should reject invalid payload (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('should create a contact with default lead score and consents', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `contact-a-${stamp}@example.com`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          country: 'CO',
          leadSource: 'concierge',
          company: 'Example Co',
          tags: ['vip'],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(`contact-a-${stamp}@example.com`);
      expect(res.body.lifecycleStage).toBe('lead');
      expect(res.body.emailOptIn).toBe(false);
      expect(res.body.leadScore).toBeGreaterThan(0);

      const duplicate = await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: `contact-a-${stamp}@example.com`, company: 'Renamed Co' })
        .expect(201);

      expect(duplicate.body.id).toBe(res.body.id);
      expect(duplicate.body.company).toBe('Renamed Co');
      contactId = duplicate.body.id;
    });
  });

  describe('querying', () => {
    it('should list contacts paginated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('should get contact by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.email).toBe(`contact-a-${stamp}@example.com`);
    });

    it('should 404 on unknown contact', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/crm/contacts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('administrative updates', () => {
    it('PATCH /contacts/:id should update admin fields', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/contacts/${contactId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'VIP traveler from referrals',
          jobTitle: 'CTO',
          timezone: 'America/Bogota',
          lifecycleStage: 'prospect',
          doNotContact: false,
        })
        .expect(200);

      expect(res.body.notes).toBe('VIP traveler from referrals');
      expect(res.body.jobTitle).toBe('CTO');
      expect(res.body.timezone).toBe('America/Bogota');
      expect(res.body.lifecycleStage).toBe('prospect');
    });

    it('PATCH /contacts/:id/consents should update opt-ins', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/contacts/${contactId}/consents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailOptIn: true, whatsappOptIn: true })
        .expect(200);

      expect(res.body.emailOptIn).toBe(true);
      expect(res.body.whatsappOptIn).toBe(true);
    });

    it('PATCH /contacts/:id/consents with doNotContact sets unsubscribedAt', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/contacts/${contactId}/consents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ doNotContact: true })
        .expect(200);

      expect(res.body.doNotContact).toBe(true);
      expect(res.body.unsubscribedAt).toBeDefined();
    });

    it('PATCH /contacts/:id/tags should merge tags', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/contacts/${contactId}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tags: ['whale'] })
        .expect(200);

      expect(res.body.tags).toContain('vip');
      expect(res.body.tags).toContain('whale');
    });
  });

  describe('interactions', () => {
    it('should log a booking interaction type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contactId,
          type: 'booking_paid',
          channel: 'app',
          subject: 'T-123',
          metadata: { bookingId: contactId, bookingReference: 'T-123' },
        })
        .expect(201);

      expect(res.body.type).toBe('booking_paid');
    });

    it('should log an interaction on an existing contact', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contactId,
          type: 'email_sent',
          channel: 'email',
          subject: 'Welcome to Medellin',
        })
        .expect(201);

      expect(res.body.contactId).toBe(contactId);
      expect(res.body.type).toBe('email_sent');
    });

    it('should create a contact implicitly from email and log interaction', async () => {
      const email = `interaction-${stamp}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          type: 'concierge_chat',
          channel: 'concierge',
          content: 'Asked about nightlife tours',
        })
        .expect(201);

      expect(res.body.type).toBe('concierge_chat');
    });

    it('should reject interaction without contact identification (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'note', channel: 'manual' })
        .expect(404);
    });

    it('should list interactions for a contact', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].contactId).toBe(contactId);
    });
  });

  describe('export', () => {
    it('GET /contacts/:id/export should return CSV', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/contacts/${contactId}/export`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('"email","firstName"');
      expect(res.text).toContain(`contact-a-${stamp}@example.com`);
    });
  });

  describe('queue integration', () => {
    const linkedEmail = `link-user-${stamp}@example.com`;

async function waitForContact(email: string, timeoutMs = 15000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/crm/contacts?email=${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    last = res.body.items;
    if (last.length > 0) return last[0];
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

    it(
      'registering a user links the CRM contact via the queue',
      async () => {
        const user = {
          email: linkedEmail,
          password: 'Test1234!',
          firstName: 'Linked',
          lastName: 'User',
        };
        await request(app.getHttpServer()).post('/api/v1/auth/register').send(user).expect(201);

        const contact = await waitForContact(linkedEmail);
        expect(contact).toBeDefined();
        expect(contact.email).toBe(linkedEmail);

        const ds = app.get(DataSource);
        const dbUser = await ds.getRepository(User).findOne({ where: { email: linkedEmail } });
        expect(dbUser).toBeDefined();
        expect(contact.userId).toBe(dbUser!.id);
      },
      20000,
    );

    it('backfill requires admin (403 for traveler)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/backfill')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
    });

    it('backfill is idempotent (second run processes nothing new)', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/crm/backfill')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(first.body).toHaveProperty('processed');
      expect(first.body).toHaveProperty('newContacts');
      expect(first.body).toHaveProperty('interactionsLogged');
      expect(first.body).toHaveProperty('skipped');

      const second = await request(app.getHttpServer())
        .post('/api/v1/crm/backfill')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(second.body.processed).toBe(0);
      expect(second.body.interactionsLogged).toBe(0);
    });
  });
});