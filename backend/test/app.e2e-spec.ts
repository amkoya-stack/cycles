import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_DEV_OTP_RETURN = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // Match main.ts configuration
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('Auth register -> otp send -> verify -> tokens', async () => {
    const server = app.getHttpServer();
    const email = `john_${Date.now()}@example.com`;
    const password = 'SuperSecure123!';
    const registerRes = await request(server)
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);
    const userId = registerRes.body.userId;
    expect(userId).toBeDefined();

    const sendRes = await request(server)
      .post('/api/auth/otp/send')
      .send({
        channel: 'email',
        destination: email,
        purpose: 'email_verification',
      })
      .expect(201);
    const code = sendRes.body.code;
    expect(code).toBeDefined();

    const verifyRes = await request(server)
      .post('/api/auth/otp/verify')
      .send({
        channel: 'email',
        destination: email,
        purpose: 'email_verification',
        code,
      })
      .expect(201);
    expect(verifyRes.body.accessToken).toBeDefined();
    expect(verifyRes.body.refreshToken).toBeDefined();
  });

  it('Auth login with valid credentials', async () => {
    const server = app.getHttpServer();
    const email = `user_${Date.now()}@example.com`;
    const password = 'MyPassword123!';

    // First register
    await request(server)
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

    // Then login
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();
    expect(loginRes.body.userId).toBeDefined();
  });

  it('Auth login with invalid credentials', async () => {
    const server = app.getHttpServer();
    const email = `user_${Date.now()}@example.com`;

    await request(server)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword!' })
      .expect(401);
  });

  it('Rate limiting blocks excessive OTP requests', async () => {
    const server = app.getHttpServer();
    const email = `ratelimit_${Date.now()}@example.com`;

    // Make 5 requests (should succeed)
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/api/auth/otp/send')
        .send({
          channel: 'email',
          destination: email,
          purpose: 'email_verification',
        })
        .expect(201);
    }

    // 6th request should be rate limited
    const rateLimitedRes = await request(server)
      .post('/api/auth/otp/send')
      .send({
        channel: 'email',
        destination: email,
        purpose: 'email_verification',
      });

    expect(rateLimitedRes.status).toBe(400);
    expect(rateLimitedRes.body.message).toContain('Too many requests');
  });
});
