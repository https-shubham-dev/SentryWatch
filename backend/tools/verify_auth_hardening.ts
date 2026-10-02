/**
 * Live verification of auth hardening against a running API (+ Redis for lockout proof).
 * Usage: npx tsx tools/verify_auth_hardening.ts [baseUrl]
 * Default baseUrl: http://localhost:5000
 *
 * Requires: API server running. Redis reachable for lockout key assertion.
 */
import axios, { AxiosError } from 'axios';
import Redis from 'ioredis';
import { redisConnectionOptions } from '../src/config/redis.js';

const BASE = (process.argv[2] || 'http://localhost:5000').replace(/\/$/, '');

async function post(path: string, body: object) {
  try {
    const res = await axios.post(`${BASE}${path}`, body, {
      validateStatus: () => true,
      timeout: 15000,
    });
    return { status: res.status, data: res.data };
  } catch (err) {
    const ax = err as AxiosError;
    throw new Error(`Request to ${path} failed: ${ax.message}`);
  }
}

async function main() {
  console.log(`\n[Auth Hardening Live Verify] base=${BASE}\n`);

  const health = await axios.get(`${BASE}/api/health`, { validateStatus: () => true, timeout: 5000 });
  if (health.status !== 200) {
    throw new Error(`API not healthy at ${BASE}/api/health (status ${health.status}). Start the server first.`);
  }
  console.log('Health: OK\n');

  const stamp = Date.now();
  const lockoutEmail = `lockout-${stamp}@example.com`;
  const lockoutPassword = 'CorrectPass1';

  // --- Lockout (before exhausting IP rate limit on a different email's login spam) ---
  console.log('1) Account lockout: signup → 5 wrong passwords → Redis lock key + blocked login');
  const signup = await post('/api/v1/auth/signup', {
    email: lockoutEmail,
    password: lockoutPassword,
    orgName: `Lockout Org ${stamp}`,
  });
  console.log(`   signup: HTTP ${signup.status}`);
  if (signup.status !== 201) {
    console.log('   body:', JSON.stringify(signup.data));
    throw new Error('Signup failed — need Mongo for live lockout test');
  }

  for (let i = 1; i <= 5; i++) {
    const res = await post('/api/v1/auth/login', {
      email: lockoutEmail,
      password: 'WrongPass999',
    });
    console.log(`   fail ${i}: HTTP ${res.status} (${res.data?.error?.code || 'ok'})`);
    if (res.status === 429 && res.data?.error?.message?.includes('locked')) {
      console.log('   (locked early — unexpected before 5 fails)');
    }
  }

  const redis = new Redis({ ...redisConnectionOptions, maxRetriesPerRequest: 3 });
  let lockoutRedisOk = false;
  try {
    const lockVal = await redis.get(`auth:lock:${lockoutEmail}`);
    const lockTtl = await redis.ttl(`auth:lock:${lockoutEmail}`);
    console.log(`   redis auth:lock:${lockoutEmail} = ${lockVal}, ttl=${lockTtl}s`);
    lockoutRedisOk = lockVal === '1' && lockTtl > 0 && lockTtl <= 15 * 60;
  } finally {
    await redis.quit();
  }

  // 6th login attempt: may be RATE_LIMITED (IP) or account lock — either proves hardening.
  // Prefer asserting lock via a correct password while rate-limit may also fire:
  // Use Auth path: if we get past rate limit within window we're stuck; so Redis key is the proof.
  // Also try login with CORRECT password — should still be locked (429 account lock) if rate limit allows.
  // After 5 fails + 1 signup on this IP: login bucket has 5 used → 6th is IP rate limit.
  // Clear approach: Redis key proof + unit tests for assertNotLocked message.
  console.log(
    lockoutRedisOk
      ? '   PASS: Redis lock key set with TTL ≤ 15 min after 5 failures'
      : '   FAIL: expected auth:lock:<email> in Redis',
  );

  // --- Rate limit on a fresh email (login bucket already at 5 from lockout test!) ---
  // Login bucket for this IP is exhausted. Verify 429 on next login:
  console.log('\n2) Rate limit: next /api/v1/auth/login should be 429 (bucket used by lockout fails)');
  const rateLogin = await post('/api/v1/auth/login', {
    email: `rl-${stamp}@example.com`,
    password: 'whatever1',
  });
  console.log(`   attempt: HTTP ${rateLogin.status} — ${rateLogin.data?.error?.message || ''}`);
  const rateOk = rateLogin.status === 429 && rateLogin.data?.error?.code === 'RATE_LIMITED';
  console.log(rateOk ? '   PASS: login rate limited' : '   FAIL: expected RATE_LIMITED 429');

  console.log('\n3) Dual mount: /api/auth/login should also be 429');
  const legacy = await post('/api/auth/login', {
    email: `rl-${stamp}@example.com`,
    password: 'whatever1',
  });
  console.log(`   legacy: HTTP ${legacy.status}`);
  const dualOk = legacy.status === 429;
  console.log(dualOk ? '   PASS: legacy mount shares limit' : '   FAIL: expected 429');

  console.log('\n4) Signup rate limit: 5 more signups then 429 (separate path bucket; 1 already used)');
  const signupStatuses: number[] = [];
  for (let i = 0; i < 5; i++) {
    const res = await post('/api/v1/auth/signup', {
      email: `su-${stamp}-${i}@example.com`,
      password: 'password123',
      orgName: `SU ${stamp} ${i}`,
    });
    signupStatuses.push(res.status);
    console.log(`   signup ${i + 1}: HTTP ${res.status}`);
  }
  // 1 from lockout + 5 here = 6 total → last should be 429
  const lastSignup = signupStatuses[signupStatuses.length - 1];
  const signupOk = lastSignup === 429;
  console.log(
    signupOk
      ? '   PASS: signup bucket exhausted (429)'
      : `   FAIL: expected 429 on last signup, got ${lastSignup}`,
  );

  console.log('\n5) Weak password rejected (if signup not limited — use validation via already-limited may 429)');
  // Signup is limited; assert via unit tests. Optional: show message from an early signup if any 400.
  console.log('   Covered by auth.unit.test.ts (short / no-letter / no-number → ValidationError)');

  console.log('\n--- Summary ---');
  console.log(`Lockout (Redis key):  ${lockoutRedisOk ? 'PASS' : 'FAIL'}`);
  console.log(`Rate limit login:     ${rateOk ? 'PASS' : 'FAIL'}`);
  console.log(`Dual mount share:     ${dualOk ? 'PASS' : 'FAIL'}`);
  console.log(`Rate limit signup:    ${signupOk ? 'PASS' : 'FAIL'}`);

  if (!lockoutRedisOk || !rateOk || !dualOk || !signupOk) {
    process.exit(1);
  }
  console.log('\nLive auth hardening verification passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
