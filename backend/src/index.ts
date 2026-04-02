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
import uploadsRoutes from './routes/uploads.routes'
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


app.listen(3000, () =>
  console.log('REST API server ready at: http://localhost:3000'),
)

export { app }