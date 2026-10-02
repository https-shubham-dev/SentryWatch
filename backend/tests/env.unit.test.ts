import { resolveJwtSecret } from '../src/config/env.js';

describe('ENV JWT secret production guard', () => {
  it('throws when nodeEnv=production and secret is missing', () => {
    expect(() =>
      resolveJwtSecret('JWT_SECRET', undefined, 'production', 'dev-fallback'),
    ).toThrow(/JWT_SECRET must be set when NODE_ENV=production/);
  });

  it('throws when nodeEnv=production and secret is blank', () => {
    expect(() =>
      resolveJwtSecret('JWT_REFRESH_SECRET', '   ', 'production', 'dev-fallback'),
    ).toThrow(/JWT_REFRESH_SECRET must be set when NODE_ENV=production/);
  });

  it('allows missing secrets in development with fallbacks', () => {
    expect(resolveJwtSecret('JWT_SECRET', undefined, 'development', 'dev-secret')).toBe(
      'dev-secret',
    );
  });

  it('prefers provided secret over fallback', () => {
    expect(resolveJwtSecret('JWT_SECRET', 'real-secret', 'production', 'dev-fallback')).toBe(
      'real-secret',
    );
  });
});
