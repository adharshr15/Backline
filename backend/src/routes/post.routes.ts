import { RequestHandler, Router } from 'express'
import {
  createPost, getProfilePosts, getPost, deletePost,
  addComment, deleteComment, likePost, unlikePost,
} from '../controllers/post.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { uploadMedia } from '../config/multer'

const router = Router()

// Public reads
router.get('/', getProfilePosts as RequestHandler)
router.get('/:id', getPost as RequestHandler)

// Authenticated writes
router.use(authenticate as RequestHandler)
router.post('/', uploadMedia.single('media'), createPost as RequestHandler)
router.delete('/:id', deletePost as RequestHandler)
router.post('/:id/comments', addComment as RequestHandler)
router.delete('/comments/:commentId', deleteComment as RequestHandler)
router.post('/:id/like', likePost as RequestHandler)
router.delete('/:id/like', unlikePost as RequestHandler)

export default router
