import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';

const TEST_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sentrywatch_test';

describe('Auth Integration Tests (Requires Mongo Connection)', () => {
  let isConnected = false;

  beforeAll(async () => {
    try {
      await mongoose.connect(TEST_MONGO_URI, { serverSelectionTimeoutMS: 2000 });
      isConnected = true;
    } catch (_err) {
      console.warn('[Test Info] Mongo DB not reachable, skipping live DB integration test');
    }
  });

  afterAll(async () => {
    if (isConnected) {
      await mongoose.disconnect();
    }
  });

  it('should run live integration tests if Mongo is available', async () => {
    if (!isConnected) {
      console.info('[Skipped] Mongo DB container not running');
      return;
    }

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
