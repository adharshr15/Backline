import 'dotenv/config';
import express from "express";
import userRoutes from './routes/user.routes'
import bandRoutes from './routes/band.routes'
import venueRoutes from './routes/venue.routes'
import tourRoutes from './routes/tour.routes'
import showRoutes from './routes/show.routes'
import conversationRoutes from './routes/conversation.routes'
import authRoutes from './routes/auth.routes'
import followRoutes from './routes/follow.routes'
import searchRoutes from './routes/search.routes'
import uploadsRoutes from './routes/uploads.routes'
import membershipRoutes from './routes/membership.routes'
import sceneRoutes from './routes/scene.routes'
import listingRoutes from './routes/listing.routes'
import postRoutes from './routes/post.routes'
import metricsRoutes from './routes/metrics.routes'
import { generalRateLimiter } from './middlewares/rateLimit.middleware'
import { errorHandler, notFound } from './middlewares/error.middleware'
import { requireEnv } from './lib/env'

// Fail fast at boot rather than signing tokens with `undefined`.
requireEnv()

const app = express()

app.disable('x-powered-by')

app.use(express.json({ limit: '1mb' }))

app.use(generalRateLimiter)

app.use('/users', userRoutes)
app.use('/bands', bandRoutes)
app.use('/venues', venueRoutes)
app.use('/tours', tourRoutes)
app.use('/shows', showRoutes)
app.use('/conversations', conversationRoutes)
app.use("/auth", authRoutes)
app.use('/uploads', uploadsRoutes)
app.use('/follows', followRoutes)
app.use('/search', searchRoutes)
app.use('/membership-invites', membershipRoutes)
app.use('/scenes', sceneRoutes)
app.use('/listings', listingRoutes)
app.use('/posts', postRoutes)
app.use('/metrics', metricsRoutes)

app.use(notFound)
app.use(errorHandler)

export { app }
export default app
