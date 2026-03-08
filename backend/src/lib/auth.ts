import 'dotenv/config';
import jwt, { SignOptions } from "jsonwebtoken"

export const generateToken = (userId: string) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET as string, 
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d"} as SignOptions
  )
}

export const verifyToken = (token: string): string => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as string
}