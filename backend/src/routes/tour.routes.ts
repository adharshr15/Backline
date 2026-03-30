import { RequestHandler, Router } from 'express'
import { getTours, getTourById, createTour, updateTour, deleteTour } from '../controllers/tour.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', getTours as RequestHandler)
router.get('/:id', getTourById as RequestHandler)

router.use(authenticate as RequestHandler)
router.post('/', createTour as RequestHandler)
router.put("/:id", updateTour as RequestHandler)  
router.delete("/:id", deleteTour as RequestHandler)

export default router