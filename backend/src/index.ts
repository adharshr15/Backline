import { app } from './app'

const PORT = Number(process.env.PORT) || 3000

const server = app.listen(PORT, () =>
  console.log(`REST API server ready at: http://localhost:${PORT}`),
)

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — another server instance is running. Free it (netstat -ano | findstr :${PORT}, then taskkill /PID <pid> /F) and retry.`)
    process.exit(1)
  }
  throw err
})

export { app }
