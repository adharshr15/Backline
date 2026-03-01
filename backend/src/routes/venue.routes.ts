import { Router } from 'express'
import { getVenues, getVenueById, createVenue } from '../controllers/venue.controller'

const router = Router()

router.get('/', getVenues)
router.get('/:id', getVenueById)
router.post('/', createVenue)
// router.put("/:id", updateUser)  
// router.delete("/:id", deleteUser)

export default router