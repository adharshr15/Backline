import { Router } from 'express'
import { getTours, getTourById, createTour, updateTour, deleteTour } from '../controllers/tour.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', getTours)
router.get('/:id', getTourById)

router.use(authenticate)
router.post('/', createTour)
router.put("/:id", updateTour)  
router.delete("/:id", deleteTour)

export default router