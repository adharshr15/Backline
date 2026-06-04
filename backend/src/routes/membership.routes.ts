import { RequestHandler, Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  getMembershipInvites,
  respondToBandInvite,
  respondToVenueInvite,
} from "../controllers/membership.controller";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/", getMembershipInvites as RequestHandler);
router.post("/band/:id/respond", respondToBandInvite as RequestHandler);
router.post("/venue/:id/respond", respondToVenueInvite as RequestHandler);

export default router;
