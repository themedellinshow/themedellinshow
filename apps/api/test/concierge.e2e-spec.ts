import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';

describe('ConciergeController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();

  const userA = { email: `cn-a-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'C' };
  const userB = { email: `cn-b-${stamp}@test.co`, password: 'Test1234!', firstName: 'B', lastName: 'C' };

  let userAToken: string;
  let userBToken: string;
  let sessionId: string;

  const register = (u: { email: string; password: string; firstName: string; lastName: string }) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(u).expect(201);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    userAToken = (await register(userA)).body.accessToken;
    userBToken = (await register(userB)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate an itinerary publicly and degrade gracefully without the AI gateway', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/concierge/itinerary')
      .send({
        language: 'es',
        startDate: '2030-09-01',
        endDate: '2030-09-05',
        interests: ['nightlife', 'food'],
        budget: 'moderate',
        groupType: 'friends',
      })
      .expect(201);

    expect(res.body.degraded).toBe(true);
    expect(res.body.response).toBe('');
    expect(res.body.cacheHit).toBe(false);
  });

  it('should require auth for chat (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/concierge/chat')
      .send({ message: 'Hola', language: 'es' })
      .expect(401);
  });

  it('should create a chat session and persist turns (fallback text)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/concierge/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: 'Recomiéndame planes para hoy', language: 'es' })
      .expect(201);

    expect(res.body.sessionId).toBeDefined();
    expect(typeof res.body.response).toBe('string');
    expect(res.body.response.length).toBeGreaterThan(0);
    sessionId = res.body.sessionId;

    const again = await request(app.getHttpServer())
      .post('/api/v1/concierge/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ sessionId, message: '¿Y mañana?', language: 'es' })
      .expect(201);
    expect(again.body.sessionId).toBe(sessionId);
  });

  it('should list and fetch own sessions (403 for others, 404 unknown)', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/concierge/sessions')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect(list.body.map((s: any) => s.sessionId)).toContain(sessionId);

    await request(app.getHttpServer())
      .get(`/api/v1/concierge/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/concierge/sessions/does-not-exist')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);

    const mine = await request(app.getHttpServer())
      .get(`/api/v1/concierge/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect(mine.body.sessionId).toBe(sessionId);
  });

  it('should delete a session (own) and 404 afterwards', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/concierge/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/concierge/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/concierge/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);
  });

  it('should return recommendations with graceful degradation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/concierge/recommendations')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ interests: ['nightlife', 'art'], budget: 'moderate', lgbtqFriendly: true })
      .expect(201);

    expect(res.body.degraded).toBe(true);
    expect(res.body.response).toBe('');
  });
});