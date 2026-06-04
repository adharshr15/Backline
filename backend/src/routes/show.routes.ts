import { RequestHandler, Router } from 'express'
import { getShows, getShowById, createShow, updateShow, deleteShow, leaveShow, repostShow, unrepostShow, getFeedShows, rsvpShow, unrsvpShow, getRsvpShows } from '../controllers/show.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload } from '../config/multer'

const router = Router()

router.get('/feed', getFeedShows)
router.get('/rsvp', authenticate as RequestHandler, getRsvpShows as RequestHandler)
router.get('/', getShows)
router.get('/:id', getShowById)

router.use(authenticate as RequestHandler)
router.post('/', upload.fields([{ name: 'posterImage', maxCount: 1 }]), createShow as RequestHandler)
router.put("/:id", upload.fields([{ name: 'posterImage', maxCount: 1 }]), updateShow as RequestHandler)
router.delete("/:id/leave", leaveShow as RequestHandler)
router.delete("/:id", deleteShow as RequestHandler)
router.post("/:id/repost", repostShow as RequestHandler)
router.delete("/:id/repost", unrepostShow as RequestHandler)
router.post("/:id/rsvp", rsvpShow as RequestHandler)
router.delete("/:id/rsvp", unrsvpShow as RequestHandler)

export default router
