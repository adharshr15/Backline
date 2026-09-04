import rateLimit, { ipKeyGenerator } from "express-rate-limit"
import { AuthRequest } from "./auth.middleware"
import { Request, Response, NextFunction } from "express"

// `ipKeyGenerator` normalises IPv6 to a /64 subnet. Keying on the raw address would
// let one client rotate through the addresses in its own subnet to reset its budget.
const ipKey = (req: Request): string => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown")

// Authenticated callers are limited per account, anonymous ones per IP.
const getKey = (req: AuthRequest): string => (req.user?.userId ? `user:${req.user.userId}` : `ip:${ipKey(req)}`)

const createLimiter = (limit: number, windowMs: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => getKey(req as AuthRequest),
    handler: (_req: Request, res: Response, _next: NextFunction) => {
      res.status(429).json({ error: message })
    },
  })

const createIpLimiter = (limit: number, windowMs: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKey,
    handler: (_req: Request, res: Response, _next: NextFunction) => {
      res.status(429).json({ error: message })
    },
  })

export const authRateLimiter = createIpLimiter(
  20,
  15 * 60 * 1000,
  "Too many authentication attempts. Try again later.",
)

// The signup form calls these while the user types, so the budget is far looser than
// login's — but still bounded, since they confirm whether an account exists.
export const existenceCheckRateLimiter = createIpLimiter(
  60,
  60 * 1000,
  "Too many requests. Please slow down.",
)

export const messageRateLimiter = createLimiter(30, 60 * 1000, "Too many messages. Slow down.")
export const conversationRateLimiter = createLimiter(10, 60 * 1000, "Too many conversation actions. Please slow down.")
export const generalRateLimiter = createLimiter(200, 60 * 1000, "Too many requests. Please try again later.")
