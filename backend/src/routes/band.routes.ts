import {RequestHandler, Router } from 'express'
import { getBands, getBandById, createBand, updateBand, deleteBand, respondToShowInvite, respondToTourInvite } from '../controllers/band.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload } from '../config/multer'

const router = Router()

router.get('/', getBands as RequestHandler)
router.get('/:id', getBandById as RequestHandler)

router.use(authenticate as RequestHandler)

router.post('/', upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "headerImage", maxCount: 1 }
]), createBand as RequestHandler)

router.post("/show-invites/:id/respond", respondToShowInvite as RequestHandler);

router.post("/tour-invites/:id/respond", respondToTourInvite as RequestHandler)

router.put("/:id", upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "headerImage", maxCount: 1 }
]), updateBand as RequestHandler)  

router.delete("/:id", deleteBand as RequestHandler)

export default router