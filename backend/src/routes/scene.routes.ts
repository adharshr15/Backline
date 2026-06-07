import { RequestHandler, Router } from "express";
import { followScene, unfollowScene, getFollowedScenes, getSceneCities } from "../controllers/scene.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/following", getFollowedScenes as RequestHandler);
router.get("/cities", getSceneCities as RequestHandler);

router.use(authenticate as RequestHandler);
router.post("/follow", followScene as RequestHandler);
router.delete("/follow", unfollowScene as RequestHandler);

export default router;
