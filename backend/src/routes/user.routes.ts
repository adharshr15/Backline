import { RequestHandler, Router } from 'express'
import { getUsers, getUserById, getMyProfiles, getMyInvites, getMyBandInvites, getMyVenueInvites, updateUser, respondToBandInvite, respondToVenueInvite, deleteUser, getUserByUsername, discoverUsers, updateUserCrafts, } from '../controllers/user.controller'
import { recommendCraft, unrecommendCraft, getCraftRecommendations } from '../controllers/recommendation.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload } from '../config/multer'

const router = Router()

// Registration lives on POST /auth/register.

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
// `/discover` is declared before the parameterised getters so it is never read
// as a user id or username.
router.get('/discover', discoverUsers as RequestHandler)
router.get('/', getUsers as RequestHandler)
router.get('/id/:id', getUserById as RequestHandler)
router.get('/username/:username', getUserByUsername as RequestHandler)



// update and delete yourself
router.put("/me", upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "headerImage", maxCount: 1 }
    ]), updateUser as RequestHandler)
router.delete("/me", deleteUser as RequestHandler)

// Self only, enforced in the controller. Accepts "me" or the caller's own id.
router.put("/:id/crafts", updateUserCrafts as RequestHandler)

// Craft recommendations. The recommender is caller-supplied and checked with canActAs.
router.get("/:id/recommendations", getCraftRecommendations as RequestHandler)
router.post("/:id/crafts/:craft/recommend", recommendCraft as RequestHandler)
router.delete("/:id/crafts/:craft/recommend", unrecommendCraft as RequestHandler)

export default router