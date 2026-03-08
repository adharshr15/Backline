import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'
import bcrypt from "bcrypt";
import { AuthRequest } from '../middlewares/auth.middleware';

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const users = await prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    console.log(id)

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        bandMemberships: {
          include: { band: true }
        },
        venueReps: {
          include: { venue: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    delete (user as any).password;

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

export const getMyInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id as string;

    const bandInvites = await prisma.bandInvite.findMany({
      where: {
        userId,
        status: "PENDING"
      },
      include: {
        band: true
      }
    });

    const venueInvites = await prisma.venueInvite.findMany({
      where: {
        userId,
        status: "PENDING"
      },
      include: {
        venue: true
      }
    });

    res.json({
      bandInvites,
      venueInvites
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invites" });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const {
      username,
      name,
      email,
      password,
      role
    } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.user.create({
      data: {
        username,
        name,
        email,
        password: hashedPassword,
        role
      }
    });

    delete (result as any).password;

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      username,
      name,
      email,
      password,
      role,
      removeBandId,
      removeVenueId
    } = req.body;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updateData: any = {}

      if (username) updateData.username = username;
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      // remove user from band
      if (removeBandId) {
        await tx.bandMember.deleteMany({
          where: {
            userId: id,
            bandId: removeBandId
          }
        });
      }

      // remove user from venue
      if (removeVenueId) {
        await tx.venueRepresentative.deleteMany({
          where: {
            userId: id,
            venueId: removeVenueId
          }
        });
      }

      // update user information
      const user = await tx.user.update({
        where: { id },
        data: updateData,
        include: {
          bandMemberships: {
            include: { band: true }
          },
          venueReps: {
            include: { venue: true }
          }
        }

      });

      return user;
    });

    res.status(200).json(updatedUser);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

export const respondToBandInvite = async (req: AuthRequest, res: Response) => {
  try {
    const inviteId = req.params.id as string;
    const { response } = req.body;
    const userId = req.user?.userId as string;

    const invite = await prisma.bandInvite.findUnique({
      where: { id: inviteId }
    });

    if (!invite || invite.userId !== userId) {
      return res.status(404).json({ error: "Invite not found" });
    }

    if (invite.status !== "PENDING") {
      return res.status(400).json({ error: "Invite already responded to" });
    }

    await prisma.$transaction(async (tx) => {

      if (response === "ACCEPTED") {
        await tx.bandMember.create({
          data: {
            userId: userId!,
            bandId: invite.bandId,
            role: "MEMBER"
          }
        });
      }

      await tx.bandInvite.update({
        where: { id: inviteId },
        data: { status: response }
      });

    });

    res.json({ message: `Band invite ${response.toLowerCase()}` });

  } catch (error) {
    res.status(500).json({ error: "Failed to respond to band invite" });
  }
};

export const respondToVenueInvite = async (req: AuthRequest, res: Response) => {
  try {
    const inviteId = req.params.id as string;
    const { response } = req.body;
    const userId = req.user?.userId;

    const invite = await prisma.venueInvite.findUnique({
      where: { id: inviteId }
    });

    if (!invite || invite.userId !== userId) {
      return res.status(404).json({ error: "Invite not found" });
    }

    if (invite.status !== "PENDING") {
      return res.status(400).json({ error: "Invite already responded to" });
    }

    await prisma.$transaction(async (tx) => {

      if (response === "ACCEPTED") {
        await tx.venueRepresentative.create({
          data: {
            userId: userId!,
            venueId: invite.venueId
          }
        });
      }

      await tx.venueInvite.update({
        where: { id: inviteId },
        data: { status: response }
      });

    });

    res.json({ message: `Venue invite ${response.toLowerCase()}` });

  } catch (error) {
    res.status(500).json({ error: "Failed to respond to venue invite" });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: {
          bandMemberships: true,
          venueReps: true,
          conversations: true
        }
      });

      if (!user) throw new Error("User not found");

      // ---- Handle Bands (remove membership only) ----
      for (const membership of user.bandMemberships) {
        await tx.bandMember.delete({
          where: { id: membership.id }
        });
      }

      // ---- Handle Venue Representatives (remove membership only) ----
      for (const rep of user.venueReps) {
        await tx.venueRepresentative.delete({
          where: { id: rep.id }
        });
      }

      // ---- Delete Band Invites ----
      await tx.bandInvite.deleteMany({
        where: { userId: id }
      });

      // ---- Delete Venue Invites ----
      await tx.venueInvite.deleteMany({
        where: { userId: id }
      });

      // ---- Handle Messages: preserve in conversation ----
      // Message stays, sender removed
      await tx.message.updateMany({
        where: { senderId: id },
        data: { senderId: null }
      });

      // ---- Remove user from conversation participants ----
      await tx.conversationParticipant.deleteMany({
        where: { userId: id }
      });

      // ---- Delete empty conversations ----
      const emptyConversations = await tx.conversation.findMany({
        where: {
          participants: { none: {} }
        }
      });

      for (const convo of emptyConversations) {
        await tx.conversation.delete({
          where: { id: convo.id }
        });
      }

      // ---- Finally, delete the user ----
      await tx.user.delete({
        where: { id }
      });
    });

    res.json({ message: "User deleted successfully, messages preserved" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};