import { Router } from 'express'
import { getShows, getShowById, createShow, updateShow, deleteShow } from '../controllers/show.controller'

const router = Router()

router.get('/', getShows)
router.get('/:id', getShowById)
router.post('/', createShow)
router.put("/:id", updateShow)  
router.delete("/:id", deleteShow)

export default router