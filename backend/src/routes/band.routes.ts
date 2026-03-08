import { Router } from 'express'
import { getBands, getBandById, createBand, updateBand, deleteBand, respondToInvite } from '../controllers/band.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', getBands)
router.get('/:id', getBandById)

router.use(authenticate)
router.post('/', createBand)
router.post("/:id/invite/respond", respondToInvite);
router.put("/:id", updateBand)  
router.delete("/:id", deleteBand)

export default router