import { RequestHandler, Router } from 'express'
import { getShows, getShowById, createShow, updateShow, deleteShow } from '../controllers/show.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', getShows)
router.get('/:id', getShowById)

router.use(authenticate as RequestHandler)
router.post('/', createShow as RequestHandler)
router.put("/:id", updateShow as RequestHandler)  
router.delete("/:id", deleteShow as RequestHandler)

export default router