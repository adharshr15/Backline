import 'dotenv/config';
import express from "express";
import userRoutes from './routes/user.routes'
import bandRoutes from './routes/band.routes'
import venueRoutes from './routes/venue.routes'
import tourRoutes from './routes/tour.routes'
import showRoutes from './routes/show.routes'
import conversationRoutes from './routes/conversation.routes'
import messageRoutes from './routes/message.routes'
import authRoutes from './routes/auth.routes'
import followRoutes from './routes/follow.routes'
import searchRoutes from './routes/search.routes'
import uploadsRoutes from './routes/uploads.routes'
import membershipRoutes from './routes/membership.routes'
import sceneRoutes from './routes/scene.routes'
import listingRoutes from './routes/listing.routes'
import { generalRateLimiter } from './middlewares/rateLimit.middleware';
import path from 'path'

const app = express()

app.use(express.json())

app.use(generalRateLimiter)

app.use('/users', userRoutes)
app.use('/bands', bandRoutes)
app.use('/venues', venueRoutes)
app.use('/tours', tourRoutes)
app.use('/shows', showRoutes)
app.use('/conversations', conversationRoutes)
app.use('/messages', messageRoutes)
app.use("/auth", authRoutes)
app.use('/uploads', uploadsRoutes);
app.use('/follows', followRoutes);
app.use('/search', searchRoutes);
app.use('/membership-invites', membershipRoutes);
app.use('/scenes', sceneRoutes);
app.use('/listings', listingRoutes);


const server = app.listen(3000, () =>
  console.log('REST API server ready at: http://localhost:3000'),
)

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port 3000 is already in use — another server instance is running. Free it (netstat -ano | findstr :3000, then taskkill /PID <pid> /F) and retry.')
    process.exit(1)
  }
  throw err
})

export { app }