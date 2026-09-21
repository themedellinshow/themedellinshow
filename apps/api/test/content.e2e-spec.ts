import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('Content (events, guides, places, map) (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const eventTitle = `Fiestas de la Candelaria ${stamp}`;
  const lat = 6.2088;
  const lng = -75.5686;

  const admin = { email: `ct-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'C' };
  const partner = { email: `ct-partner-${stamp}@test.co`, password: 'Test1234!', firstName: 'P', lastName: 'C' };
  const traveler = { email: `ct-trav-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'C' };

  let adminToken: string;
  let partnerToken: string;
  let travelerToken: string;

  let eventId: string;
  let guideId: string;
  let placeId: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  const futureEvent = () => ({
    titleEs: eventTitle,
    titleEn: `${eventTitle} EN`,
    descriptionEs: 'Evento cultural',
    descriptionEn: 'Cultural event',
    category: 'cultural',
    startsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 31 * 24 * 3600 * 1000).toISOString(),
    venueName: 'Teatro Metropolitano',
    neighborhood: 'La Candelaria',
    latitude: lat,
    longitude: lng,
    lgbtqFriendly: true,
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
    partnerToken = (await register(partner)).body.accessToken;
    await app.get(DataSource).getRepository(User).update({ email: partner.email }, { role: 'partner' });
    travelerToken = (await register(traveler)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('events', () => {
    it('should gate creation to admin/partner (401/403)', async () => {
      await request(app.getHttpServer()).post('/api/v1/events').send(futureEvent()).expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send(futureEvent())
        .expect(403);
    });

    it('should create an event as draft (admin and partner)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(futureEvent())
        .expect(201);
      expect(res.body.status).toBe('draft');
      eventId = res.body.id;

      const partnerRes = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ ...futureEvent(), titleEs: `Partner event ${stamp}` })
        .expect(201);
      expect(partnerRes.body.status).toBe('draft');
    });

    it('should not expose drafts publicly but expose via GET /:id', async () => {
      const list = await request(app.getHttpServer())
        .get(`/api/v1/events?search=${encodeURIComponent(eventTitle)}&limit=50`)
        .expect(200);
      expect(list.body.items.map((e: any) => e.id)).not.toContain(eventId);

      const one = await request(app.getHttpServer()).get(`/api/v1/events/${eventId}`).expect(200);
      expect(one.body.status).toBe('draft');
    });

    it('should reject status changes by non-admin (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/events/${eventId}/status`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ status: 'published' })
        .expect(403);
    });

    it('should publish via admin and become visible (upcoming)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/events/${eventId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'published' })
        .expect(200);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/events?search=${encodeURIComponent(eventTitle)}&limit=50`)
        .expect(200);
      expect(list.body.items.map((e: any) => e.id)).toContain(eventId);

      const upcoming = await request(app.getHttpServer())
        .get('/api/v1/events/upcoming?days=60')
        .expect(200);
      expect(upcoming.body.map((e: any) => e.id)).toContain(eventId);
    });
  });

  describe('guides', () => {
    it('should gate guide creation to admin only (partner 403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/guides')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ slug: 'x', category: 'neighborhood', titleEs: 't', titleEn: 't', summaryEs: 's', summaryEn: 's', content: {} })
        .expect(403);
    });

    it('should create a guide (draft) and reject duplicate slugs (409)', async () => {
      const body = {
        slug: `guia-candelaria-${stamp}`,
        category: 'neighborhood',
        titleEs: 'Guia de la Candelaria',
        titleEn: 'Candelaria guide',
        summaryEs: 'Resumen',
        summaryEn: 'Summary',
        content: { es: [{ type: 'paragraph', data: 'texto' }], en: [{ type: 'paragraph', data: 'text' }] },
        tags: ['walking'],
      };
      const res = await request(app.getHttpServer())
        .post('/api/v1/guides')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(201);
      expect(res.body.status).toBe('draft');
      guideId = res.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/guides')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(409);
    });

    it('should expose draft guide via slug and increment viewCount', async () => {
      const slug = `guia-candelaria-${stamp}`;
      await request(app.getHttpServer()).get(`/api/v1/guides/slug/${slug}`).expect(200);

      const guide = await waitFor(async () => {
        const res = await request(app.getHttpServer()).get(`/api/v1/guides/slug/${slug}`).expect(200);
        return res.body.viewCount >= 2 ? res.body : null;
      }, 4000);

      expect(guide.viewCount).toBeGreaterThanOrEqual(2);
    });

    it('should publish via admin and appear in the public list', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/guides/${guideId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/guides?search=${encodeURIComponent('Guia de la Candelaria')}&limit=50`)
        .expect(200);
      expect(list.body.items.map((g: any) => g.id)).toContain(guideId);
    });
  });

  describe('places and map', () => {
    it('should create a place (admin only) and expose it', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/places')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nameEs: 'Café Jet Black',
          nameEn: 'Jet Black Coffee',
          descriptionEs: 'Cafetería',
          descriptionEn: 'Coffee shop',
          category: 'cafe',
          neighborhood: 'El Poblado',
          address: 'Calle 9 #43-74',
          latitude: lat,
          longitude: lng,
          lgbtqFriendly: true,
        })
        .expect(201);
      placeId = res.body.id;

      const list = await request(app.getHttpServer())
        .get(`/api/v1/places?search=${encodeURIComponent('Café Jet Black')}&limit=50`)
        .expect(200);
      expect(list.body.items.map((p: any) => p.id)).toContain(placeId);

      await request(app.getHttpServer())
        .post('/api/v1/places')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({ nameEs: 'x', nameEn: 'x', descriptionEs: 'x', descriptionEn: 'x', category: 'cafe', neighborhood: 'x', address: 'x', latitude: 1, longitude: 1 })
        .expect(403);
    });

    it('should expose places via nearby within radius', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/places/nearby?lat=${lat}&lng=${lng}&radius=5`)
        .expect(200);
      expect(res.body.map((p: any) => p.id)).toContain(placeId);
    });

    it('should place pins on the map only inside the bounding box', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/map/pins')
        .expect(400);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/map/pins?minLat=${lat - 0.02}&maxLat=${lat + 0.02}&minLng=${lng - 0.02}&maxLng=${lng + 0.02}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const pins = res.body.map((p: any) => p.type);
      expect(pins).toContain('place');
      expect(pins).toContain('event');
      const pin = res.body.find((p: any) => p.id === placeId);
      expect(pin).toBeDefined();
      expect(pin.type).toBe('place');

      const far = await request(app.getHttpServer())
        .get(`/api/v1/map/pins?minLat=${lat + 10}&maxLat=${lat + 11}&minLng=${lng + 10}&maxLng=${lng + 11}`)
        .expect(200);
      expect(far.body.map((p: any) => p.id)).not.toContain(placeId);
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