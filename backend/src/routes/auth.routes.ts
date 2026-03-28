import { Router } from "express"
import { login, register, getMe } from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth.middleware"
import { authRateLimiter, generalRateLimiter } from "../middlewares/rateLimit.middleware"

const router = Router()

router.post("/register", authRateLimiter, register)
router.post("/login", authRateLimiter, login)
router.get("/me", authenticate, generalRateLimiter, getMe)

export default router