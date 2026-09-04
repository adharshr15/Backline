import { RequestHandler, Router } from 'express';
import { getProfileMetrics } from '../controllers/metrics.controller';

const router = Router();

router.get('/:type/:id', getProfileMetrics as RequestHandler);

export default router;
