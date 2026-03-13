import { Router } from 'express'
import { getSentMessages, createMessage, deleteMessage } from '../controllers/message.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.use(authenticate)
router.post("/", createMessage)
router.get("/", getSentMessages)
router.delete("/:id", deleteMessage)  

export default router