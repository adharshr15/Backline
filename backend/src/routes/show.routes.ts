import { RequestHandler, Router } from 'express'
import { getShows, getShowById, createShow, updateShow, deleteShow, leaveShow, repostShow, unrepostShow, getFeedShows, rsvpShow, unrsvpShow, getRsvpShows, getShowMedia, addShowMedia, deleteShowMedia } from '../controllers/show.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload, uploadMedia } from '../config/multer'

const router = Router()

router.get('/feed', getFeedShows)
router.get('/rsvp', authenticate as RequestHandler, getRsvpShows as RequestHandler)
router.get('/', getShows)
router.get('/:id/media', getShowMedia as RequestHandler)
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
router.post("/:id/media", uploadMedia.single('media'), addShowMedia as RequestHandler)
router.delete("/media/:mediaId", deleteShowMedia as RequestHandler)

export default router
