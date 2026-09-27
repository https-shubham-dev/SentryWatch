import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User.js';
import { ForbiddenError, UnauthorizedError } from './errorHandler.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('User authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`Action requires one of the following roles: ${allowedRoles.join(', ')}`);
    }

    next();
  };
}
