import { Router } from 'express'
import { getMessagesForConversation, createMessage, deleteMessage } from '../controllers/message.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.use(authenticate)
router.post("/", createMessage)
router.get("/conversation/:conversationId", getMessagesForConversation)
router.delete("/:id", deleteMessage)  

export default router