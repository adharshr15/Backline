import { Router } from 'express'
import { getMessagesForConversation, createMessage, deleteMessage } from '../controllers/message.controller'

const router = Router()

router.post("/", createMessage)
router.get("/conversation/:conversationId", getMessagesForConversation)
router.delete("/:id", deleteMessage)  

export default router