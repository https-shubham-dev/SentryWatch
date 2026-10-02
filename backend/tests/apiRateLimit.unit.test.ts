import express from 'express';
import request from 'supertest';
import { apiRateLimiter } from '../src/middleware/rateLimit.js';

describe('API rate limiting (100 req/min)', () => {
  it('allows 100 authenticated-keyed requests then returns 429', async () => {
    const app = express();
    app.use(express.json());
    // Simulate authenticate having already set req.user
    app.use((req, _res, next) => {
      req.user = {
        userId: 'user-rate-limit-test',
        organizationId: 'org-1',
        role: 'admin',
      };
      next();
    });
    app.use(apiRateLimiter);
    app.get('/probe', (_req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/probe');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/probe');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  }, 30000);
});
