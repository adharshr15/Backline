import { Response, NextFunction } from "express"
import { AuthRequest } from "./auth.middleware"

export const authorize = () => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }
    

    next()
  }
}