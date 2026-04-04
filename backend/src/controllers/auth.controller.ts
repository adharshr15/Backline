import { Request, Response } from "express"
import bcrypt from "bcrypt"
import { prisma } from "../lib/prisma"
import { generateToken } from "../lib/auth"
import { AuthRequest } from "../middlewares/auth.middleware"
import { AccountType } from "../../generated/prisma/enums"

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { name, username, email, password, city, state, country } = req.body

    if (!name || !username || !email || !password || !city || !state || !country) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const files = req.files as Record<string, Express.Multer.File[]>;

    const profileImageUrl = files?.profileImage?.[0]
      ? `/uploads/${files.profileImage[0].filename}`
      : null

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) { return res.status(409).json({ error: "Username already taken" }); }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) { return res.status(409).json({ error: "Email already in use" }); }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        city,
        state,
        country,
        password: hashedPassword,
        profileImageUrl,
        accountType: "USER"
      }
    })

    const token = generateToken(user.id)


    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        city: user.city,
        state: user.state,
        country: user.country,
        accountType: user.accountType,
        profileImageUrl: user.profileImageUrl
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body

    const user = await prisma.user.findUnique({
      where: email ? { email } : { username }
    })

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = generateToken(user.id)

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        city: user.city,
        state: user.state,
        country: user.country,
        bio: user.bio,
        accountType: user.accountType,
        profileImageUrl: user.profileImageUrl,
        headerImageUrl: user.headerImageUrl
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        accountType: true,
        city: true,
        state: true,
        country: true,
        bio: true,
        profileImageUrl: true,
        headerImageUrl: true,
        createdAt: true,
        bandMemberships: true,
        venueReps: true
      }
    })

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(user)
  } catch (error) {
    console.error("getMe error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const checkEmail = async (req: Request, res: Response) => {
  const { email } = req.query;
  const existing = await prisma.user.findUnique({ where: { email: String(email) } });
  res.json({ isUnique: !existing });
};

export const checkUsername = async (req: Request, res: Response) => {
  const { username } = req.query;
  const existing = await prisma.user.findUnique({ where: { username: String(username) } });
  res.json({ isUnique: !existing });
}