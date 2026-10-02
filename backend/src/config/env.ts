import dotenv from 'dotenv';
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Resolve a JWT secret. In production, missing secrets fail loudly at boot
 * instead of silently falling back to a well-known dev string.
 */
export function resolveJwtSecret(
  name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET',
  value: string | undefined,
  nodeEnv: string,
  devFallback: string,
): string {
  if (value && value.trim().length > 0) {
    return value;
  }
  if (nodeEnv === 'production') {
    throw new Error(
      `[ENV] ${name} must be set when NODE_ENV=production. Refusing to start with a default secret.`,
    );
  }
  return devFallback;
}

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/sentrywatch',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  REDIS_TLS: process.env.REDIS_TLS === 'true',
  JWT_SECRET: resolveJwtSecret(
    'JWT_SECRET',
    process.env.JWT_SECRET,
    NODE_ENV,
    'dev-secret-key-change-in-production',
  ),
  JWT_REFRESH_SECRET: resolveJwtSecret(
    'JWT_REFRESH_SECRET',
    process.env.JWT_REFRESH_SECRET,
    NODE_ENV,
    'dev-refresh-secret-key',
  ),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
} as const;
