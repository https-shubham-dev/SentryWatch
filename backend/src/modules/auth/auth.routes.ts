import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rateLimit.js';

const router = Router();
const controller = new AuthController();

// Rate limiter covers both /api/v1/auth and /api/auth mounts (same router instance).
router.post('/signup', authRateLimiter, (req, res, next) => controller.signup(req, res, next));
router.post('/login', authRateLimiter, (req, res, next) => controller.login(req, res, next));
router.post('/refresh', (req, res, next) => controller.refresh(req, res, next));
router.post('/logout', (req, res, next) => controller.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => controller.getMe(req, res, next));

export default router;
