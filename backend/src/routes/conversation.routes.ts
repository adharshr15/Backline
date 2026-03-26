import { Router } from 'express'
import { getMyConversations, createConversation, updateConversation, respondToConversationInvite, leaveConversation, getConversation } from '../controllers/conversation.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { getMessages, sendMessage } from '../controllers/message.controller'

const router = Router()

router.use(authenticate)
router.post("/", createConversation)
router.get("/", getMyConversations)
router.get("/:id", getConversation)
router.delete("/:id", leaveConversation)
router.put("/:id", updateConversation)  

// messages
router.post("/:id/messages", sendMessage)
router.get("/:id/messages", getMessages)

// invites
router.post("/conversation-invites/:id/respond", respondToConversationInvite)

export default router