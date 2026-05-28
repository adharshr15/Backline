import { RequestHandler, Router } from 'express';
import { search } from '../controllers/search.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate as RequestHandler, search as RequestHandler);

export default router;
