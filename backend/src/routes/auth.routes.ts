import { RequestHandler, Router } from "express"
import { login, register, getMe, checkEmail, checkUsername } from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth.middleware"
import { authRateLimiter, existenceCheckRateLimiter, generalRateLimiter } from "../middlewares/rateLimit.middleware"
import { upload } from "../config/multer"

const router = Router()

router.post("/register", authRateLimiter, upload.fields([
    { name: "profileImage", maxCount: 1 }
]), register as RequestHandler)

router.post("/login", authRateLimiter, login)

router.get("/me", authenticate as RequestHandler, generalRateLimiter, getMe as RequestHandler)

// Unauthenticated existence oracles — rate limit them or they enumerate the user base.
router.get("/check-email", existenceCheckRateLimiter, checkEmail as RequestHandler)

router.get("/check-username", existenceCheckRateLimiter, checkUsername as RequestHandler)

export default router;