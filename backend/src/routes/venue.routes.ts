import { Router } from 'express'
import { getVenues, getVenueById, updateVenue, deleteVenue, createVenue, respondToInvite } from '../controllers/venue.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', getVenues)
router.get('/:id', getVenueById)

router.use(authenticate)
router.post('/', createVenue)
router.put("/:id", updateVenue)  
router.post('/:id/invite/respond', respondToInvite);
router.delete("/:id", deleteVenue)

export default router