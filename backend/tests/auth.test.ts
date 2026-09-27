import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';

const TEST_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sentrywatch_test';

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    await mongoose.disconnect();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should create user (admin) and organization atomically', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'admin@acme.com',
          password: 'securepassword123',
          orgName: 'Acme Corp',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toMatchObject({
        email: 'admin@acme.com',
        role: 'admin',
      });
      expect(res.body.organization).toMatchObject({
        name: 'Acme Corp',
      });
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('refreshToken');

      // Verify DB persistence
      const dbUser = await User.findOne({ email: 'admin@acme.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.role).toBe('admin');

      const dbOrg = await Organization.findById(dbUser?.organizationId);
      expect(dbOrg?.name).toBe('Acme Corp');
    });

    it('should reject signup with existing email with 409 Conflict', async () => {
      await request(app).post('/api/v1/auth/signup').send({
        email: 'duplicate@acme.com',
        password: 'password123',
        orgName: 'First Org',
      });

      const res = await request(app).post('/api/v1/auth/signup').send({
        email: 'duplicate@acme.com',
        password: 'password123',
        orgName: 'Second Org',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/signup').send({
        email: 'user@acme.com',
        password: 'password123',
        orgName: 'Acme Corp',
      });
    });

    it('should authenticate valid credentials and return access token + refresh cookie', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'user@acme.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe('user@acme.com');
      expect(res.headers['set-cookie'][0]).toContain('refreshToken');
    });

    it('should reject invalid password with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'user@acme.com',
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Full Session Flow: signup -> login -> /auth/me -> logout', () => {
    it('should execute full auth lifecycle correctly', async () => {
      // 1. Signup
      const signupRes = await request(app).post('/api/v1/auth/signup').send({
        email: 'cyrus@company.com',
        password: 'cyrusPassword123',
        orgName: 'Sentry Core',
      });

      expect(signupRes.status).toBe(201);
      const accessToken = signupRes.body.accessToken;

      // 2. GET /auth/me with Bearer token
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('cyrus@company.com');
      expect(meRes.body.user.role).toBe('admin');
      expect(meRes.body.organization.name).toBe('Sentry Core');

      // 3. Refresh token
      const refreshCookie = signupRes.headers['set-cookie'][0];
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty('accessToken');

      // 4. Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [refreshCookie]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.headers['set-cookie'][0]).toContain('refreshToken=;');
    });
  });
});
