import {
  assertNotLocked,
  recordFailedLogin,
  clearLoginFailures,
  MAX_FAILED_ATTEMPTS,
} from '../src/modules/auth/loginLockout.js';
import { TooManyRequestsError } from '../src/middleware/errorHandler.js';

describe('Login Lockout (Redis-backed)', () => {
  const email = `lockout-${Date.now()}@acme.com`;

  beforeEach(async () => {
    await clearLoginFailures(email);
  });

  afterEach(async () => {
    await clearLoginFailures(email);
  });

  it('allows login when there is no lock', async () => {
    await expect(assertNotLocked(email)).resolves.toBeUndefined();
  });

  it(`locks the account after ${MAX_FAILED_ATTEMPTS} consecutive failures`, async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordFailedLogin(email);
    }

    await expect(assertNotLocked(email)).rejects.toBeInstanceOf(TooManyRequestsError);
    await expect(assertNotLocked(email)).rejects.toThrow(/Account temporarily locked/);
  });

  it('clears lockout after successful login clears failures', async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordFailedLogin(email);
    }
    await expect(assertNotLocked(email)).rejects.toThrow(/Account temporarily locked/);

    await clearLoginFailures(email);
    await expect(assertNotLocked(email)).resolves.toBeUndefined();
  });
});
