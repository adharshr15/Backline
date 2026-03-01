import { Router } from 'express'
import { getBands, getBandById, createBand, updateBand, deleteBand } from '../controllers/band.controller'

const router = Router()

router.get('/', getBands)
router.get('/:id', getBandById)
router.post('/', createBand)
router.put("/:id", updateBand)  
router.delete("/:id", deleteBand)

export default router