import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';
import { JwtPayload, RefreshTokenPayload } from '../../types/auth.js';
import { UserRole } from '../../models/User.js';

export const ACCESS_TOKEN_EXPIRATION = '15m';
export const REFRESH_TOKEN_EXPIRATION = '7d';
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export function generateAccessToken(userId: string, organizationId: string, role: UserRole): string {
  const payload: JwtPayload = { userId, organizationId, role };
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

export function generateRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { userId, type: 'refresh' };
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, ENV.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token payload');
  }
  return decoded;
}
