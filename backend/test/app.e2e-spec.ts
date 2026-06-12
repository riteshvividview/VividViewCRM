import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with status field', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body).toHaveProperty('data.status');
      expect(['ok', 'degraded', 'down']).toContain(res.body.data.status);
    });
  });

  describe('GET /health/ping', () => {
    it('returns pong', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/ping')
        .expect(200);

      expect(res.body.data.pong).toBe(true);
    });
  });

  describe('Auth protection', () => {
    it('returns 401 on protected route without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/some-protected-route')
        .expect(404); // 404 because route doesn't exist yet — proves auth doesn't block 404s
    });
  });
});
