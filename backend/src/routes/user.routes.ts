import { Router } from 'express'
import { getUsers, getUserById, getMyInvites, getMyBandInvites, getMyVenueInvites, createUser, updateUser, respondToBandInvite, respondToVenueInvite, deleteUser, } from '../controllers/user.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// public routes (registration)
router.post('/', createUser)

// protected routes
router.use(authenticate)

// invites
router.get("/me/invites", getMyInvites)
router.get("/me/band-invites", getMyBandInvites)
router.get("/me/venue-invites", getMyVenueInvites)

router.post("/band-invites/:id/respond", respondToBandInvite)
router.post("/venue-invites/:id/respond", respondToVenueInvite)

// get users
router.get('/', getUsers)
router.get('/:id', getUserById)

// update and delete yourself
router.put("/me", updateUser)
router.delete("/me", deleteUser)

export default router