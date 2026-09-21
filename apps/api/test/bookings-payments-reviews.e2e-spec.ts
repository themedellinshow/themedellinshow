import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';
import { CrmContact } from '../src/modules/crm/entities/crm-contact.entity';
import { CrmInteraction } from '../src/modules/crm/entities/crm-interaction.entity';
import { BookingsReminderScheduler } from '../src/modules/bookings/bookings-reminder.scheduler';

describe('Bookings-Payments-Reviews (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const priceCop = 100000;
  const maxParticipants = 6;

  const admin = { email: `bpr-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'B' };
  const hostA = { email: `bpr-host-a-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'A' };
  const hostB = { email: `bpr-host-b-${stamp}@test.co`, password: 'Test1234!', firstName: 'H', lastName: 'B' };
  const traveler = { email: `bpr-trav-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'T' };
  const traveler2 = { email: `bpr-trav2-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'B' };

  let adminToken: string;
  let hostAToken: string;
  let hostBToken: string;
  let travelerToken: string;
  let traveler2Token: string;

  let expActiveId: string;
  let expDraftId: string;
  let b1: string; // completed (review target)
  let b1Ref: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  const makeHost = async (token: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hosts/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bioEs: 'Hola', bioEn: 'Hi', languagesSpoken: ['en'] })
      .expect(201);
    return res.body.id;
  };

  const createExperience = (token: string, titleEs: string) =>
    request(app.getHttpServer())
      .post('/api/v1/experiences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titleEs,
        titleEn: `${titleEs} EN`,
        descriptionEs: 'Desc',
        descriptionEn: 'Desc',
        category: 'cultural',
        priceCop,
        durationMinutes: 120,
        maxParticipants,
        minParticipants: 1,
        neighborhood: 'Laureles',
      });

  const createBooking = (token: string, experienceId: string, contactEmail: string, participants = 2) =>
    request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        experienceId,
        bookingDate: '2030-06-15',
        startTime: '10:30',
        participants,
        contactEmail,
        contactPhone: '+573001112233',
      });

  const pay = async (token: string, bookingId: string) => {
    const init = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId })
      .expect(201);
    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/payments/${init.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return confirm.body;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    adminToken = (await register(admin)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: admin.email }, { role: 'admin' });

    hostAToken = (await register(hostA)).body.accessToken;
    await makeHost(hostAToken);
    hostBToken = (await register(hostB)).body.accessToken;
    await makeHost(hostBToken);

    travelerToken = (await register(traveler)).body.accessToken;
    traveler2Token = (await register(traveler2)).body.accessToken;

    const exp = await createExperience(hostAToken, `Visita Palacio ${stamp}`);
    expActiveId = exp.body.id;
    const draft = await createExperience(hostAToken, `Borrador ${stamp}`);
    expDraftId = draft.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/experiences/${expActiveId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('create booking', () => {
    it('should reject unknown fields and malformed payload (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({ experienceId: expActiveId, bogus: true })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          experienceId: expActiveId,
          bookingDate: '2030-06-15',
          startTime: '25:99',
          participants: 1,
          contactEmail: 'x@test.co',
        })
        .expect(400);
    });

    it('should reject bookings against a non-active experience (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          experienceId: expDraftId,
          bookingDate: '2030-06-15',
          startTime: '09:00',
          participants: 1,
          contactEmail: 'x@test.co',
        })
        .expect(400);
      expect(res.body.message).toBe('Experience is not available for booking');
    });

    it('should enforce participant bounds (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          experienceId: expActiveId,
          bookingDate: '2030-06-15',
          startTime: '09:00',
          participants: maxParticipants + 1,
          contactEmail: 'x@test.co',
        })
        .expect(400);
    });

    it('should create a pending booking with computed totals', async () => {
      const res = await createBooking(travelerToken, expActiveId, `bpr-c1-${stamp}@test.co`, 3).expect(201);
      expect(res.body.status).toBe('pending');
      expect(res.body.subtotalCop).toBe(priceCop * 3);
      expect(Number(res.body.totalCop)).toBe(priceCop * 3 * 1.1);
      expect(res.body.bookingReference).toMatch(/^MDS-/);
      b1 = res.body.id;
      b1Ref = res.body.bookingReference;
    });
  });

  describe('booking lifecycle', () => {
    it('should list mine via /bookings/mine', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/mine')
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(200);
      expect(res.body.map((b: any) => b.id)).toContain(b1);
    });

    it('should resolve by reference', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/ref/${b1Ref}`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(200);
      expect(res.body.id).toBe(b1);
    });

    it('should confirm by the owning host, reject others, and reject re-confirm', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${b1}/confirm`)
        .set('Authorization', `Bearer ${hostBToken}`)
        .expect(403);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${b1}/confirm`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(200);
      expect(res.body.status).toBe('confirmed');

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${b1}/confirm`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(400);
    });

    it('should let the traveler pay and the booking become paid', async () => {
      const res = await pay(travelerToken, b1);
      expect(res.status).toBe('completed');

      const booking = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${b1}`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(200);
      expect(booking.body.status).toBe('paid');
    });

    it('should reject payment initiation by a non-owner (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ bookingId: b1 })
        .expect(400);
    });

    it('should complete a paid booking (host only) and guard transitions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${b1}/complete`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(403);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${b1}/complete`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(200);
      expect(res.body.status).toBe('completed');

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${b1}/complete`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(400);
    });
  });

  describe('refund', () => {
    it('should refund a completed payment (admin) and set booking refunded', async () => {
      const booking = await createBooking(traveler2Token, expActiveId, `bpr-r-${stamp}@test.co`).expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.body.id}/confirm`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(200);
      const payment = await pay(traveler2Token, booking.body.id);

      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${traveler2Token}`)
        .expect(403);

      const refunded = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(refunded.body.status).toBe('refunded');
      const after = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${booking.body.id}`)
        .set('Authorization', `Bearer ${traveler2Token}`)
        .expect(200);
      expect(after.body.status).toBe('refunded');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending booking by traveler and reject cancelling a completed one', async () => {
      const booking = await createBooking(travelerToken, expActiveId, `bpr-cx-${stamp}@test.co`).expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.body.id}/cancel`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({ reason: 'Changed plans' })
        .expect(200);
      expect(res.body.status).toBe('cancelled');

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${b1}/cancel`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(400);
    });

    it('should auto-refund a paid booking that gets cancelled (async pipeline)', async () => {
      const booking = await createBooking(travelerToken, expActiveId, `bpr-are-${stamp}@test.co`).expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.body.id}/confirm`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(200);
      const payment = await pay(travelerToken, booking.body.id);
      expect(payment.status).toBe('completed');

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.body.id}/cancel`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({ reason: 'Plan changed' })
        .expect(200);

      await waitFor(async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/payments/booking/${booking.body.id}`)
          .set('Authorization', `Bearer ${travelerToken}`)
          .expect(200);
        const latest = res.body.find((p: any) => p.id === payment.id);
        return latest?.status === 'refunded' && latest?.refundedAt ? latest : null;
      }, 15000);

      const after = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${booking.body.id}`)
        .set('Authorization', `Bearer ${travelerToken}`)
        .expect(200);
      expect(after.body.status).toBe('refunded');
    });
  });

  describe('booking reminders', () => {
    it('should enqueue and deliver a booking reminder for tomorrow via the scheduler', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          experienceId: expActiveId,
          bookingDate: tomorrowDate(),
          startTime: '10:00',
          participants: 2,
          contactEmail: `bpr-rem-${stamp}@test.co`,
          contactPhone: '+573001112233',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${res.body.id}/confirm`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .expect(200);

      const scheduler = app.get(BookingsReminderScheduler);
      await scheduler.scanForReminders();

      await waitFor(async () => {
        const contact = await app
          .get(DataSource)
          .getRepository(CrmContact)
          .findOne({ where: { email: traveler.email } });
        if (!contact) return null;
        const interaction = await app
          .get(DataSource)
          .getRepository(CrmInteraction)
          .findOne({
            where: { contactId: contact.id, type: 'email_sent' },
            order: { createdAt: 'DESC' },
          });
        return interaction?.metadata?.notificationType === 'BOOKING_REMINDER'
          ? interaction
          : null;
      }, 15000);
    });

    it('should not re-enqueue a reminder already delivered', async () => {
      const contact = await app
        .get(DataSource)
        .getRepository(CrmContact)
        .findOne({ where: { email: traveler.email } });
      expect(contact).toBeDefined();

      const interactionRepo = app.get(DataSource).getRepository(CrmInteraction);
      const before = await interactionRepo.count({ where: { contactId: contact!.id } });

      await app.get(BookingsReminderScheduler).scanForReminders();
      await sleep(1500);

      const after = await interactionRepo.count({ where: { contactId: contact!.id } });
      expect(after).toBe(before);
    });
  });

  describe('reviews', () => {
    let reviewId: string;

    it('should reject reviews for non-completed bookings and by non-travelers', async () => {
      const pendingBooking = await createBooking(travelerToken, expActiveId, `bpr-p-${stamp}@test.co`).expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          bookingId: pendingBooking.body.id,
          rating: 5,
          content: 'Aún no termina, no debería dejar.',
          language: 'es',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${traveler2Token}`)
        .send({
          bookingId: b1,
          rating: 5,
          content: 'No soy el traveler de esta reserva.',
          language: 'es',
        })
        .expect(403);
    });

    it('should create a review pending moderation and reject duplicates', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          bookingId: b1,
          rating: 5,
          content: 'Experiencia inolvidable, muy recomendada.',
          language: 'es',
          hostRating: 5,
          valueRating: 4,
        })
        .expect(201);

      expect(res.body.status).toBe('pending_moderation');
      expect(res.body.verified).toBe(true);
      reviewId = res.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          bookingId: b1,
          rating: 5,
          content: 'Segunda reseña no permitida.',
          language: 'es',
        })
        .expect(400);
    });

    it('should not expose the review publicly until approved', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/experience/${expActiveId}`)
        .expect(200);
      expect(res.body.map((r: any) => r.id)).not.toContain(reviewId);
    });

    it('should let only the review host respond (403 otherwise)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/reviews/${reviewId}/response`)
        .set('Authorization', `Bearer ${hostBToken}`)
        .send({ response: 'Gracias' })
        .expect(403);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/reviews/${reviewId}/response`)
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ response: 'Gracias por venir' })
        .expect(201);
      expect(res.body.hostResponse).toBe('Gracias por venir');
    });

    it('should increment helpfulCount (public)', async () => {
      await request(app.getHttpServer()).post(`/api/v1/reviews/${reviewId}/helpful`).expect(201);
      await request(app.getHttpServer()).post(`/api/v1/reviews/${reviewId}/helpful`).expect(201);

      const res = await request(app.getHttpServer()).get(`/api/v1/reviews/${reviewId}`).expect(200);
      expect(res.body.helpfulCount).toBeGreaterThanOrEqual(1);
    });

    it('should approve via admin and become visible in the public list', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/experience/${expActiveId}`)
        .expect(200);
      expect(res.body.map((r: any) => r.id)).toContain(reviewId);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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