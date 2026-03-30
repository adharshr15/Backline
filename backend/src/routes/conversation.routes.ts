import { RequestHandler, Router } from 'express'
import { getMyConversations, createConversation, updateConversation, respondToConversationInvite, leaveConversation, getConversation } from '../controllers/conversation.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { getMessages, sendMessage } from '../controllers/message.controller'
import { messageRateLimiter, conversationRateLimiter } from "../middlewares/rateLimit.middleware"

const router = Router()

router.use(authenticate as RequestHandler)

// invites
router.post("/conversation-invites/:id/respond", conversationRateLimiter, respondToConversationInvite as RequestHandler)

// conversations
router.post("/", conversationRateLimiter, createConversation as RequestHandler)
router.get("/", getMyConversations as RequestHandler)
router.get("/:id", getConversation as RequestHandler)
router.delete("/:id", conversationRateLimiter, leaveConversation as RequestHandler)
router.put("/:id", conversationRateLimiter, updateConversation as RequestHandler)  

// messages
router.post("/:id/messages", messageRateLimiter, sendMessage as RequestHandler)
router.get("/:id/messages", messageRateLimiter, getMessages as RequestHandler)

export default router