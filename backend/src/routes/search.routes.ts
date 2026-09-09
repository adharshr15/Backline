import { RequestHandler, Router } from 'express';
import { search } from '../controllers/search.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { searchRateLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

// authenticate first, so the limiter keys per account rather than per IP.
router.get('/', authenticate as RequestHandler, searchRateLimiter, search as RequestHandler);

export default router;
