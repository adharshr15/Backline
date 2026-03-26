import { Router } from 'express'
import { getMyConversations, createConversation, updateConversation, respondToConversationInvite, leaveConversation, getConversation } from '../controllers/conversation.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.use(authenticate)
router.post("/", createConversation)
router.get("/", getMyConversations)
router.get("/:id", getConversation)
router.delete("/:id", leaveConversation)
router.put("/:id", updateConversation)  

// invites
router.post("/conversation-invites/:id/respond", respondToConversationInvite)

export default router