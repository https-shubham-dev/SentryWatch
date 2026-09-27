import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
const controller = new AuthController();

router.post('/signup', (req, res, next) => controller.signup(req, res, next));
router.post('/login', (req, res, next) => controller.login(req, res, next));
router.post('/refresh', (req, res, next) => controller.refresh(req, res, next));
router.post('/logout', (req, res, next) => controller.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => controller.getMe(req, res, next));

export default router;
