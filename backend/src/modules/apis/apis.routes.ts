import { Router } from 'express';
import { ApisController } from './apis.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();
const controller = new ApisController();

// All routes require valid JWT authentication
router.use(authenticate);

router.get('/', (req, res, next) => controller.getApis(req, res, next));
router.get('/:id', (req, res, next) => controller.getApiById(req, res, next));

// Admin-only mutation routes
router.post('/', requireRole('admin'), (req, res, next) => controller.createApi(req, res, next));
router.patch('/:id', requireRole('admin'), (req, res, next) => controller.updateApi(req, res, next));
router.delete('/:id', requireRole('admin'), (req, res, next) => controller.deleteApi(req, res, next));

export default router;
