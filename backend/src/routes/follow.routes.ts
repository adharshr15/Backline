import { RequestHandler, Router } from 'express';
import { follow, unfollow, checkFollowing, getFollowers, getFollowing } from '../controllers/follow.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/check', authenticate as RequestHandler, checkFollowing as RequestHandler);
router.get('/followers/:type/:id', getFollowers as RequestHandler);
router.get('/following/:type/:id', getFollowing as RequestHandler);

router.use(authenticate as RequestHandler);

router.post('/', follow as RequestHandler);
router.delete('/', unfollow as RequestHandler);

export default router;
