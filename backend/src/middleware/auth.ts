import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/jwt.utils.js';
import { UnauthorizedError } from './errorHandler.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (_err) {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
