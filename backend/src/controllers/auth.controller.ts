import { Request, Response } from "express"
import bcrypt from "bcrypt"
import { prisma } from "../lib/prisma"
import { generateToken } from "../lib/auth"
import { AuthRequest } from "../middlewares/auth.middleware"
import { fail } from "../middlewares/error.middleware"
import { resolveSceneId } from "../lib/scenes"

const BCRYPT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8

// A real bcrypt hash of a value nobody can supply, compared against when the
// account does not exist so login timing does not leak account existence.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.6aBLLo0m5tS0fh2xB2f3nJXsQ0Q9YfW"

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { name, username, email, password, city, state, country } = req.body

    if (!name || !username || !email || !password || !city || !state || !country) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
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

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const sceneId = await resolveSceneId({ city, state, country });

    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        city,
        state,
        country,
        sceneId,
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
  } catch (error) {
    return fail(res, error, "register")
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body

    if ((!email && !username) || !password) {
      return res.status(400).json({ error: "Missing credentials" })
    }

    const user = await prisma.user.findUnique({
      where: email ? { email } : { username }
    })

    // Always run a bcrypt comparison so a missing account and a wrong password
    // take the same time — otherwise the response latency reveals which usernames exist.
    const hash = user?.password ?? DUMMY_HASH
    const valid = await bcrypt.compare(password, hash)

    if (!user || !valid) {
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
  } catch (error) {
    return fail(res, error, "login")
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
        bandMemberships: { include: { band: true } },
        venueReps: { include: { venue: true } }
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

// These power inline "already taken" hints on the signup form, so they are
// necessarily unauthenticated and necessarily confirm existence. The rate limiter
// on the route is what stops them being used to enumerate the whole user base.
export const checkEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    res.json({ isUnique: !existing });
  } catch (error) {
    return fail(res, error, "checkEmail");
  }
};

export const checkUsername = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "username is required" });
    }
    const existing = await prisma.user.findUnique({ where: { username } });
    res.json({ isUnique: !existing });
  } catch (error) {
    return fail(res, error, "checkUsername");
  }
}