import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Api } from '../models/Api.js';
import { reconcileScheduledJobs } from '../workers/scheduler.js';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  await mongoose.connect(ENV.MONGODB_URI);

  // 1. Create or fetch Demo Organization
  let org = await Organization.findOne({ slug: 'acme-corp' });
  if (!org) {
    org = await Organization.create({
      name: 'Acme Corp Engineering',
      slug: 'acme-corp',
    });
    console.log(`Created Organization: ${org.name} (${org._id})`);
  } else {
    console.log(`Found existing Organization: ${org.name}`);
  }

  // 2. Create or fetch Demo Admin User
  let user = await User.findOne({ email: 'admin@sentrywatch.com' });
  if (!user) {
    const passwordHash = await bcrypt.hash('password123', 10);
    user = await User.create({
      organizationId: org._id,
      email: 'admin@sentrywatch.com',
      passwordHash,
      role: 'admin',
    });
    console.log(`Created Admin User: ${user.email} (${user._id})`);
  } else {
    console.log(`Found existing Admin User: ${user.email}`);
  }

  // 3. Seed Demo APIs
  const demoApis = [
    {
      name: 'Demo Target Status Endpoint',
      url: 'http://localhost:4000/status',
      method: 'GET' as const,
      expectedStatus: 200,
      checkIntervalSeconds: 60,
      enabled: true,
    },
    {
      name: 'User Authentication Service',
      url: 'http://localhost:4000/ok',
      method: 'GET' as const,
      expectedStatus: 200,
      checkIntervalSeconds: 60,
      enabled: true,
    },
    {
      name: 'Payment Gateway Endpoint',
      url: 'http://localhost:4000/fail',
      method: 'GET' as const,
      expectedStatus: 200,
      checkIntervalSeconds: 300,
      enabled: true,
    },
    {
      name: 'Analytics Batch Processor',
      url: 'http://localhost:4000/slow',
      method: 'GET' as const,
      expectedStatus: 200,
      checkIntervalSeconds: 60,
      enabled: true,
    },
  ];

  for (const apiData of demoApis) {
    const existingApi = await Api.findOne({
      organizationId: org._id,
      name: apiData.name,
    });

    if (!existingApi) {
      const createdApi = await Api.create({
        ...apiData,
        organizationId: org._id,
        currentStatus: 'unknown',
      });
      console.log(`Created API: "${createdApi.name}" (${createdApi.url})`);
    } else {
      console.log(`Found existing API: "${existingApi.name}"`);
    }
  }

  // 4. Reconcile BullMQ repeatable jobs
  await reconcileScheduledJobs();
  console.log('Synced BullMQ scheduler repeatable jobs for all enabled APIs.');

  console.log('\n✅ Database seeding complete!');
  console.log('--------------------------------------------------');
  console.log('Demo Credentials:');
  console.log('  Email:    admin@sentrywatch.com');
  console.log('  Password: password123');
  console.log('--------------------------------------------------');

  await mongoose.disconnect();
  process.exit(0);
}

if (process.env.NODE_ENV !== 'test') {
  seedDatabase().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
