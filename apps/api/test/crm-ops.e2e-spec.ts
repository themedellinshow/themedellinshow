import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('CRM operations (tags, merge, dashboard, automations) (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const emailA = `ops-a-${stamp}@test.co`;
  const emailB = `ops-b-${stamp}@test.co`;
  const travelerEmail = `ops-trav-${stamp}@test.co`;
  const newUser = { email: `ops-new-${stamp}@test.co`, password: 'Test1234!', firstName: 'N', lastName: 'O' };

  const admin = { email: `ops-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'O' };
  const hostUser = { email: `ops-host-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'O' };
  const travelerUser = { email: travelerEmail, password: 'Test1234!', firstName: 'T', lastName: 'O' };

  let adminToken: string;
  let hostToken: string;
  let travelerToken: string;
  let contactAId: string;
  let contactBId: string;
  let expId: string;
  let automationConfirmId: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  const adminGet = (url: string) =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${adminToken}`);

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
    await request(app.getHttpServer())
      .post('/api/v1/hosts/profile')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ bioEs: 'H', bioEn: 'H', languagesSpoken: ['es'] })
      .expect(201);

    travelerToken = (await register(travelerUser)).body.accessToken;

    const exp = await request(app.getHttpServer())
      .post('/api/v1/experiences')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        titleEs: `Ops tour ${stamp}`,
        titleEn: `Ops tour ${stamp}`,
        descriptionEs: 'Desc',
        descriptionEn: 'Desc',
        category: 'adventure',
        priceCop: 60000,
        durationMinutes: 90,
        maxParticipants: 3,
        neighborhood: 'Centro',
      })
      .expect(201);
    expId = exp.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/experiences/${expId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);

    // Automation for the booking-confirmed event.
    const auto = await request(app.getHttpServer())
      .post('/api/v1/crm/automations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Confirm tag ${stamp}`,
        eventType: 'booking_confirmed',
        actions: [{ type: 'add_tags', tags: ['auto-confirm'] }],
        status: 'active',
      })
      .expect(201);
    automationConfirmId = auto.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('dashboard access', () => {
    it('should gate dashboard to admin/partner', async () => {
      await request(app.getHttpServer()).get('/api/v1/crm/dashboard').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/crm/dashboard')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);
    });
  });

  describe('tags', () => {
    it('should create contacts with tags and list tag usage', async () => {
      const a = await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: emailA, firstName: 'Ana', tags: ['alpha', 'beta'] })
        .expect(201);
      contactAId = a.body.id;

      const b = await request(app.getHttpServer())
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: emailB, firstName: 'Beta' })
        .expect(201);
      contactBId = b.body.id;

      const tags = await adminGet('/api/v1/crm/tags').expect(200);
      expect(tags.body.find((t: any) => t.name === 'alpha')?.count ?? 0).toBeGreaterThanOrEqual(1);
      expect(tags.body.find((t: any) => t.name === 'beta')?.count ?? 0).toBeGreaterThanOrEqual(1);
    });

    it('should add tags with dedupe via PATCH', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/crm/contacts/${contactAId}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tags: ['beta', 'gamma'] })
        .expect(200);
      expect(res.body.tags).toEqual(expect.arrayContaining(['alpha', 'beta', 'gamma']));

      const tags = await adminGet('/api/v1/crm/tags').expect(200);
      expect(tags.body.find((t: any) => t.name === 'beta')?.count ?? 0).toBeGreaterThanOrEqual(1);
      expect(tags.body.find((t: any) => t.name === 'gamma')?.count ?? 0).toBeGreaterThanOrEqual(1);
    });
  });

  describe('merge', () => {
    it('should merge source into target and move its records', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/interactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: emailA, type: 'email_opened', channel: 'email', subject: 'Newsletter' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/contacts/${contactAId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Nota previa al merge' })
        .expect(201);

      const merged = await request(app.getHttpServer())
        .post('/api/v1/crm/contacts/merge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sourceId: contactAId, targetId: contactBId })
        .expect(201);

      expect(merged.body.id).toBe(contactBId);
      expect(merged.body.tags).toEqual(expect.arrayContaining(['alpha', 'beta', 'gamma']));

      const source = await adminGet(`/api/v1/crm/contacts/${contactAId}`).expect(404);

      const interactions = await adminGet(`/api/v1/crm/contacts/${contactBId}/interactions`).expect(200);
      expect(interactions.body.length).toBe(1);

      const notes = await adminGet(`/api/v1/crm/contacts/${contactBId}/notes`).expect(200);
      expect(notes.body.length).toBe(1);
    });

    it('should reject self-merge and unknown contacts', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/contacts/merge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sourceId: contactBId, targetId: contactBId })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/crm/contacts/merge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sourceId: contactBId, targetId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
    });
  });

  describe('dashboard', () => {
    it('should expose aggregate KPIs with a stable shape', async () => {
      const res = await adminGet('/api/v1/crm/dashboard').expect(200);

      expect(res.body.totalContacts).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('customers');
      expect(Array.isArray(res.body.byLifecycle)).toBe(true);
      expect(Array.isArray(res.body.byLeadSource)).toBe(true);
      expect(res.body.optIns).toHaveProperty('email');
      expect(res.body.openTasks).toBeGreaterThanOrEqual(0);
      expect(res.body.activeAutomations).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.pipelines)).toBe(true);
      expect(res.body.pipelines[0].stages).toBeInstanceOf(Array);
      expect(res.body.pipelines[0].stages[0]).toHaveProperty('count');
      expect(Array.isArray(res.body.bookings)).toBe(true);
    });
  });

  describe('event-driven automations', () => {
    it('should fire a booking_confirmed automation on host confirm', async () => {
      const booking = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          experienceId: expId,
          bookingDate: '2030-09-10',
          startTime: '14:00',
          participants: 1,
          contactEmail: travelerEmail,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.body.id}/confirm`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      const contact = await waitFor(async () => {
        const res = await adminGet(`/api/v1/crm/contacts?email=${encodeURIComponent(travelerEmail)}`).expect(200);
        const item = res.body.items[0];
        return item?.tags?.includes('auto-confirm') ? item : null;
      }, 8000);

      expect(contact.tags).toContain('auto-confirm');

      await waitFor(async () => {
        const runs = await adminGet(`/api/v1/crm/automations/${automationConfirmId}/runs`).expect(200);
        return runs.body.items.length >= 1 ? runs.body.items : null;
      }, 8000);
    });

    it('should fire a payment_received automation once the traveler pays', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Paid tag ${stamp}`,
          eventType: 'payment_received',
          actions: [{ type: 'add_tags', tags: ['auto-paid'] }],
          status: 'active',
        })
        .expect(201);

      const booking = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          experienceId: expId,
          bookingDate: '2030-09-12',
          startTime: '15:00',
          participants: 1,
          contactEmail: travelerEmail,
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

      const contact = await waitFor(async () => {
        const res = await adminGet(`/api/v1/crm/contacts?email=${encodeURIComponent(travelerEmail)}`).expect(200);
        const item = res.body.items[0];
        return item?.tags?.includes('auto-paid') ? item : null;
      }, 8000);

      expect(contact.tags).toContain('auto-paid');
    });

    it('should fire a contact_created automation on registration', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/crm/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Welcome tag ${stamp}`,
          eventType: 'contact_created',
          actions: [{ type: 'add_tags', tags: ['auto-new'] }],
          status: 'active',
        })
        .expect(201);

      await register(newUser);

      const contact = await waitFor(async () => {
        const res = await adminGet(`/api/v1/crm/contacts?email=${encodeURIComponent(newUser.email)}`).expect(200);
        const item = res.body.items[0];
        return item?.tags?.includes('auto-new') ? item : null;
      }, 8000);

      expect(contact.tags).toContain('auto-new');
      expect(contact.userId).toBeDefined();
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