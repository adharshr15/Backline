import { RequestHandler, Router } from "express";
import {
    followScene,
    unfollowScene,
    getFollowedScenes,
    getSceneCities,
    getScenes,
    getSceneBySlug,
    getSceneByLocation,
    getSceneBands,
    getSceneVenues,
    getScenePeople,
    getSceneShows,
} from "../controllers/scene.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// ---------------------------------------------------------------------------
// Route order is load-bearing. Express matches in declaration order, so every
// literal path has to be declared before "/:slug" or it is swallowed as a slug.
// ---------------------------------------------------------------------------

router.get("/following", getFollowedScenes as RequestHandler);
router.get("/cities", getSceneCities as RequestHandler);
router.get("/by-location", getSceneByLocation as RequestHandler);

router.get("/", getScenes as RequestHandler);

// Sub-resources before the bare "/:slug".
router.get("/:slug/bands", getSceneBands as RequestHandler);
router.get("/:slug/venues", getSceneVenues as RequestHandler);
router.get("/:slug/people", getScenePeople as RequestHandler);
router.get("/:slug/shows", getSceneShows as RequestHandler);
router.get("/:slug", getSceneBySlug as RequestHandler);

router.use(authenticate as RequestHandler);
router.post("/follow", followScene as RequestHandler);
router.delete("/follow", unfollowScene as RequestHandler);

export default router;
