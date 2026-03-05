import { Router } from 'express'
import { getVenues, getVenueById, updateVenue, deleteVenue, createVenue } from '../controllers/venue.controller'

const router = Router()

router.get('/', getVenues)
router.get('/:id', getVenueById)
router.post('/', createVenue)
router.put("/:id", updateVenue)  
router.delete("/:id", deleteVenue)

export default router