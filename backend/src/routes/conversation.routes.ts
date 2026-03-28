import { Router } from 'express'
import { getMyConversations, createConversation, updateConversation, respondToConversationInvite, leaveConversation, getConversation } from '../controllers/conversation.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { getMessages, sendMessage } from '../controllers/message.controller'
import { messageRateLimiter, conversationRateLimiter } from "../middlewares/rateLimit.middleware"

const router = Router()

router.use(authenticate)

// invites
router.post("/conversation-invites/:id/respond", conversationRateLimiter, respondToConversationInvite)

// conversations
router.post("/", conversationRateLimiter, createConversation)
router.get("/", getMyConversations)
router.get("/:id", getConversation)
router.delete("/:id", conversationRateLimiter, leaveConversation)
router.put("/:id", conversationRateLimiter, updateConversation)  

// messages
router.post("/:id/messages", messageRateLimiter, sendMessage)
router.get("/:id/messages", messageRateLimiter, getMessages)

export default router