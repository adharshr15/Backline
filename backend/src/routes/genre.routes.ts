import { RequestHandler, Router } from "express";
import { getGenres } from "../controllers/genre.controller";

const router = Router();

// Public: the taxonomy is reference data with nothing user-specific in it.
router.get("/", getGenres as RequestHandler);

export default router;
