import { Router } from 'express'
import { getVenues, getVenueById, updateVenue, deleteVenue, createVenue, respondToShowInvite } from '../controllers/venue.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', getVenues)
router.get('/:id', getVenueById)

router.use(authenticate)
router.post('/', createVenue)
router.put("/:id", updateVenue)  
router.post('/shows/invites/:id/respond', respondToShowInvite);
router.delete("/:id", deleteVenue)

export default router