import { RequestHandler, Router } from 'express'
import {
  getListings,
  getListingById,
  getListingsByProfile,
  getListingMedia,
  createListing,
  updateListing,
  setListingStatus,
  deleteListing,
  addListingMedia,
  deleteListingMedia,
  reorderListingPhotos,
} from '../controllers/listing.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { upload, uploadMedia } from '../config/multer'

const router = Router()

// PUBLIC
router.get('/profile', getListingsByProfile)
router.get('/', getListings)
router.get('/:id/media', getListingMedia as RequestHandler)
router.get('/:id', getListingById)

// AUTHED
router.use(authenticate as RequestHandler)
router.post('/', upload.single('coverImage'), createListing as RequestHandler)
router.put('/:id', upload.single('coverImage'), updateListing as RequestHandler)
router.patch('/:id/status', setListingStatus as RequestHandler)
router.delete('/:id', deleteListing as RequestHandler)
router.post('/:id/media', uploadMedia.single('media'), addListingMedia as RequestHandler)
router.put('/:id/photos', reorderListingPhotos as RequestHandler)
router.delete('/media/:mediaId', deleteListingMedia as RequestHandler)

export default router
