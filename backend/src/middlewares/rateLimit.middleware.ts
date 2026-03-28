import rateLimit from "express-rate-limit"
import { AuthRequest } from "./auth.middleware"
import { Request, Response, NextFunction } from "express"

const normalizeIp = (ip: string | undefined): string => {
  if (!ip) return "unknown"
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip
}

const extractIp = (req: Request): string => {
  const { ip, socket } = req
  return normalizeIp(ip ?? socket?.remoteAddress)
}

const getKey = (req: AuthRequest): string => {
  return req.user?.userId ?? extractIp(req)
}

const createLimiter = (max: number, windowMs: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => getKey(req as AuthRequest),
    handler: (_req: Request, res: Response, _next: NextFunction) => {
      res.status(429).json({ error: message })
    },
  })

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => extractIp(req),
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    res.status(429).json({
      error: "Too many authentication attempts. Try again later."
    })
  }
})

export const messageRateLimiter = createLimiter(30, 60 * 1000, "Too many messages. Slow down.")
export const conversationRateLimiter = createLimiter(10, 60 * 1000, "Too many conversation actions. Please slow down.")
export const generalRateLimiter = createLimiter(200, 60 * 1000, "Too many requests. Please try again later.")