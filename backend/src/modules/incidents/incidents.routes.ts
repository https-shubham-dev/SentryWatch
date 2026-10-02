import { Router } from 'express';
import { IncidentsController } from './incidents.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { apiRateLimiter } from '../../middleware/rateLimit.js';

const router = Router();
const controller = new IncidentsController();

router.use(authenticate);
router.use(apiRateLimiter);

router.get('/', (req, res, next) => controller.getIncidents(req, res, next));
router.get('/:id', (req, res, next) => controller.getIncidentById(req, res, next));
router.patch('/:id/status', (req, res, next) => controller.updateStatus(req, res, next));

export default router;
