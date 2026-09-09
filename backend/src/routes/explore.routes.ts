import { RequestHandler, Router } from "express";
import { getExplore } from "../controllers/explore.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { exploreRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

// authenticate first, so the limiter keys per account rather than per IP.
router.get("/", authenticate as RequestHandler, exploreRateLimiter, getExplore as RequestHandler);

export default router;
