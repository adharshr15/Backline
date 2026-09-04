import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { jwtSecret } from "../lib/env"

export interface AuthRequest extends Request {
  user?: {
    userId: string
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

  const [scheme, token] = header.split(" ")

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({ error: "Malformed Authorization header" })
  }

  try {
    const decoded = jwt.verify(token, jwtSecret()) as { userId?: string }

    // The token only ever carries `userId` (see lib/auth.ts). Reject anything else
    // rather than letting a payload-shaped token through with an undefined id.
    if (!decoded?.userId) {
      return res.status(401).json({ error: "Invalid token" })
    }

    req.user = { userId: decoded.userId }

    next()
  } catch {
    return res.status(401).json({ error: "Invalid token" })
  }
}
