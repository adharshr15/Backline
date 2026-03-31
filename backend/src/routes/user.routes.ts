import { RequestHandler, Router } from 'express'
import { getUsers, getUserById, getMyProfiles, getMyInvites, getMyBandInvites, getMyVenueInvites, createUser, updateUser, respondToBandInvite, respondToVenueInvite, deleteUser, } from '../controllers/user.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload } from '../config/multer'

const router = Router()

// public routes (registration)
// router.post('/', createUser)

// protected routes
router.use(authenticate as RequestHandler)

// invites
router.get("/me/invites", getMyInvites as RequestHandler)
router.get("/me/band-invites", getMyBandInvites as RequestHandler)
router.get("/me/venue-invites", getMyVenueInvites as RequestHandler)

// get profiles
router.get('/me/profiles', getMyProfiles as RequestHandler)

router.post("/band-invites/:id/respond", respondToBandInvite as RequestHandler)
router.post("/venue-invites/:id/respond", respondToVenueInvite as RequestHandler)

// get users
router.get('/', getUsers as RequestHandler)
router.get('/:id', getUserById as RequestHandler)



// update and delete yourself
router.put("/me", upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "headerImage", maxCount: 1 }
    ]), updateUser as RequestHandler)
router.delete("/me", deleteUser as RequestHandler)

export default router