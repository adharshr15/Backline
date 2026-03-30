import { RequestHandler, Router } from 'express'
import { getVenues, getVenueById, updateVenue, deleteVenue, createVenue, respondToShowInvite } from '../controllers/venue.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload } from '../config/multer'
const router = Router()

router.get('/', getVenues as RequestHandler)
router.get('/:id', getVenueById as RequestHandler)

router.use(authenticate as RequestHandler)

router.post('/', upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "headerImage", maxCount: 1 }
]), createVenue as RequestHandler)

router.put("/:id", upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "headerImage", maxCount: 1 }
]), updateVenue as RequestHandler)  

router.post('/shows/invites/:id/respond', respondToShowInvite as RequestHandler);
router.delete("/:id", deleteVenue as RequestHandler)

export default router