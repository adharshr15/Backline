import { Router } from 'express'
import { getUsers, getUserById, getMyInvites, createUser, updateUser, respondToBandInvite, respondToVenueInvite, deleteUser, } from '../controllers/user.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// public routes (registration)
router.post('/', createUser)

// protected routes
router.use(authenticate)
router.get('/', getUsers)
router.get('/:id', getUserById)
router.put("/:id", updateUser)  
router.get("/me/invites", getMyInvites)
router.post("/band-invites/:id/respond", respondToBandInvite)
router.post("/venue-invites/:id/respond", respondToVenueInvite)
router.delete("/:id", deleteUser)

export default router