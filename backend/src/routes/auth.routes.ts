import { RequestHandler, Router } from "express"
import { login, register, getMe } from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth.middleware"
import { authRateLimiter, generalRateLimiter } from "../middlewares/rateLimit.middleware"
import { upload } from "../config/multer"

const router = Router()

router.post("/register", authRateLimiter, upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "headerImage", maxCount: 1 }
]), register)
router.post("/login", authRateLimiter, login)
router.get("/me", authenticate as RequestHandler, generalRateLimiter, getMe as RequestHandler)

export default router