import { RequestHandler, Router } from 'express'
import { getShows, getShowById, createShow, updateShow, deleteShow } from '../controllers/show.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload } from '../config/multer'

const router = Router()

router.get('/', getShows)
router.get('/:id', getShowById)

router.use(authenticate as RequestHandler)
router.post('/', upload.fields([{ name: 'posterImage', maxCount: 1 }]), createShow as RequestHandler)
router.put("/:id", upload.fields([{ name: 'posterImage', maxCount: 1 }]), updateShow as RequestHandler)
router.delete("/:id", deleteShow as RequestHandler)

export default router
