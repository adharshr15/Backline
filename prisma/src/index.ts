import { prisma } from './lib/prisma'
import express from "express";
import userRoutes from './routes/user.routes'

const app = express()

app.use(express.json())

app.use('/users', userRoutes)

app.listen(3000, () =>
  console.log('REST API server ready at: http://localhost:3000'),
)

