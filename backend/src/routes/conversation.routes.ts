import { Router } from 'express'
import { getUserConversations, getConversationById, createConversation, updateConversation, deleteConversation } from '../controllers/conversation.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.use(authenticate)
router.post("/", createConversation)
router.get("/:id", getConversationById)
router.get("/user/:userId", getUserConversations)
router.delete("/:id", deleteConversation)
router.put("/:id", updateConversation)  

export default router