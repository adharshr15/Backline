import 'dotenv/config';
import express from "express";
import userRoutes from './routes/user.routes'
import bandRoutes from './routes/band.routes'
import venueRoutes from './routes/venue.routes'
import tourRoutes from './routes/tour.routes'

const app = express()

app.use(express.json())

app.use('/users', userRoutes)
app.use('/bands', bandRoutes)
app.use('/venues', venueRoutes)
app.use('/tours', tourRoutes)


app.listen(3000, () =>
  console.log('REST API server ready at: http://localhost:3000'),
)

export { app }