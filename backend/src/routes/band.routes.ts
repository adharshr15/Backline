import { Router } from 'express'
import { getBands, getBandById, createBand, updateBand, deleteBand, respondToShowInvite, respondToTourInvite } from '../controllers/band.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', getBands)
router.get('/:id', getBandById)

router.use(authenticate)
router.post('/', createBand)
router.post("/shows/invites/:id/respond", respondToShowInvite);
router.post("/tours/invites/:id/respond", respondToTourInvite)
router.put("/:id", updateBand)  
router.delete("/:id", deleteBand)

export default router