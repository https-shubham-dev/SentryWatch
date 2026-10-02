import express from 'express';
import request from 'supertest';
import { authRateLimiter } from '../src/middleware/rateLimit.js';

/**
 * Verifies the auth rate limiter itself (5/min) without needing Mongo.
 * Mounted the same way as production: dual prefixes sharing one router path.
 */
function buildTestApp() {
  const router = express.Router();
  router.post('/login', authRateLimiter, (_req, res) => {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'stub' } });
  });
  router.post('/signup', authRateLimiter, (_req, res) => {
    res.status(201).json({ ok: true });
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', router);
  app.use('/api/auth', router);
  return app;
}

describe('Auth rate limiting (5 req/min)', () => {
  it('returns 429 on the 6th login within a minute; dual mounts share the bucket', async () => {
    const app = buildTestApp();
    const body = { email: 'ratelimit@example.com', password: 'x' };

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/v1/auth/login').send(body);
      expect(res.status).toBe(401);
    }

    const sixthV1 = await request(app).post('/api/v1/auth/login').send(body);
    expect(sixthV1.status).toBe(429);
    expect(sixthV1.body.error.code).toBe('RATE_LIMITED');

    // Same router path `/login` under legacy prefix — shares the IP+path bucket
    const sixthLegacy = await request(app).post('/api/auth/login').send(body);
    expect(sixthLegacy.status).toBe(429);
    expect(sixthLegacy.body.error.code).toBe('RATE_LIMITED');
  });

  it('tracks signup separately from login (still 5/min)', async () => {
    const app = buildTestApp();

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: `s${i}@e.com`, password: 'password123', orgName: 'Org' });
      expect(res.status).toBe(201);
    }

    const sixth = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'final@e.com', password: 'password123', orgName: 'Org' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('RATE_LIMITED');
  });
});
