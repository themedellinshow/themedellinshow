import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'Test1234!',
    firstName: 'Test',
    lastName: 'User',
  };
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/auth/register (POST) - should register user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('/api/v1/auth/register (POST) - should reject duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(409);
  });

  it('/api/v1/auth/login (POST) - should login user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });

  it('/api/v1/auth/login (POST) - should reject wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'wrong' })
      .expect(401);
  });

  it('/api/v1/users/me (GET) - should return profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(testUser.email);
    expect(res.body.firstName).toBe(testUser.firstName);
  });

  it('/api/v1/auth/refresh (POST) - should refresh tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });
});
