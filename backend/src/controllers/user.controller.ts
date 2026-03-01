import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany()
    res.json(users)
  } catch (error: any) {
    console.error("Prisma getUsers error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(user)
  } catch (error: any) {
    console.error("Prisma getUserById error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, username, name, role } = req.body

    const user = await prisma.user.create({
      data: { email, password, username, name, role },
    })

    res.status(201).json(user)
  } catch (error: any) {
    console.error("Prisma createUser error:", error.message)
    res.status(500).json({ error: error.message })
  }
}

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { email, password, username, name, role } = req.body

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        email,
        password,
        username,
        name,
        role,
      },
    })

    res.json(updatedUser)
  } catch (error: any) {
    console.error("Prisma updateUser error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" })
    }

    res.status(500).json({ error: error.message })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string

    await prisma.user.delete({
      where: { id }
    })

    res.json({ message: "User deleted successfully" })
  } catch (error: any) {
    console.error("Prisma deleteUser error:", error.message)

    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" })
    }

    res.status(500).json({ error: error.message })
  }
}