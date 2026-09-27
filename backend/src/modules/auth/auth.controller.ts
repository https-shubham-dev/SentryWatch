import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { REFRESH_COOKIE_MAX_AGE_MS } from './jwt.utils.js';

const authService = new AuthService();

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, org, accessToken, refreshToken } = await authService.signup(req.body);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      });

      res.status(201).json({
        accessToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          organizationId: user.organizationId.toString(),
        },
        organization: {
          id: org._id.toString(),
          name: org.name,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, org, accessToken, refreshToken } = await authService.login(req.body);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      });

      res.status(200).json({
        accessToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          organizationId: user.organizationId.toString(),
        },
        organization: {
          id: org._id.toString(),
          name: org.name,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      const { accessToken } = await authService.refresh(refreshToken);
      res.status(200).json({ accessToken });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await authService.getMe(userId);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }
}
