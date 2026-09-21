import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { User } from '../src/modules/users/entities/user.entity';

describe('NewsController (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const source = `bn-${stamp}`;
  const title = `Noticia ${stamp}`;

  const admin = { email: `nw-admin-${stamp}@test.co`, password: 'Test1234!', firstName: 'A', lastName: 'N' };
  const traveler = { email: `nw-trav-${stamp}@test.co`, password: 'Test1234!', firstName: 'T', lastName: 'N' };

  let adminToken: string;
  let travelerToken: string;
  let articleId: string;

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
    travelerToken = (await register(traveler)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should gate ingest to admin (401/403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/news/ingest')
      .send({ title, content: 'Contenido de la noticia', source: 'rastrear-co' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/news/ingest')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ title, content: 'Contenido de la noticia', source: 'rastrear-co' })
      .expect(403);
  });

  it('should ingest an article as pending', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/news/ingest')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title,
        content: 'Contenido de la noticia sobre Medellín.',
        source,
        sourceUrl: 'https://example.com/nota',
        publishedAt: new Date().toISOString(),
      })
      .expect(201);

    expect(res.body.status).toBe('pending');
    articleId = res.body.id;

    const pending = await request(app.getHttpServer())
      .get('/api/v1/news/admin/pending?limit=50')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pending.body.items.map((a: any) => a.id)).toContain(articleId);
  });

  it('should not expose pending articles in the public feed', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/news?limit=50')
      .expect(200);
    expect(res.body.items.map((a: any) => a.id)).not.toContain(articleId);

    const one = await request(app.getHttpServer()).get(`/api/v1/news/${articleId}`).expect(200);
    expect(one.body.status).toBe('pending');
  });

  it('should change status via admin (403 for traveler) and publish', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/news/${articleId}/status`)
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ status: 'approved' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/news/${articleId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' })
      .expect(200);

    const feed = await request(app.getHttpServer())
      .get('/api/v1/news?limit=50')
      .expect(200);
    expect(feed.body.items.map((a: any) => a.id)).toContain(articleId);
  });

  it('should toggle featured (admin) and filter by it', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/news/${articleId}/featured`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ featured: true })
      .expect(200);

    const featured = await request(app.getHttpServer())
      .get('/api/v1/news?featured=true&limit=50')
      .expect(200);
    expect(featured.body.items.map((a: any) => a.id)).toContain(articleId);
  });
});