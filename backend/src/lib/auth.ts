import 'dotenv/config';
import jwt, { SignOptions } from "jsonwebtoken"
import { jwtSecret } from "./env"

export interface TokenPayload {
  userId: string
}

export const generateToken = (userId: string) => {
  return jwt.sign(
    { userId },
    jwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as SignOptions
  )
}

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, jwtSecret()) as TokenPayload
}
