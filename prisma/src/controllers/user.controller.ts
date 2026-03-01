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