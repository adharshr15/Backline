import { Request, Response, NextFunction } from "express"
import { RateLimiterMemory } from "rate-limiter-flexible"
import jwt from "jsonwebtoken"

export interface AuthRequest extends Request {
  user?: {
    userId: string
    role: string
  };
  files?: { 
    [fieldName: string]: Express.Multer.File[] 
  };
}


export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({ error: "No token provided" })
  }

  const token = header.split(" ")[1]

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string, role: string }

    req.user = decoded

    next()
  } catch {
    return res.status(401).json({ error: "Invalid token" })
  }
}