import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'
import bcrypt from "bcrypt";
import { InviteStatus } from '../../generated/prisma/enums'
import { AuthRequest } from '../middlewares/auth.middleware';
import { AccountType } from '../../generated/prisma/enums';
import { userPrivateSelect, userPublicSelect, userCraftsSelect, bandGenresSelect, flattenGenres } from '../lib/prismaSelects';
import { fail } from '../middlewares/error.middleware';
import { resolveSceneId, stateSpellings } from '../lib/scenes';
import { Craft } from '../../generated/prisma/enums';
import { clampLimit, parsePage, parseCsv, parseBool, parseText, paginated } from '../lib/query';
import fs from 'fs';
import path from 'path';


const MAX_PAGE_SIZE = 100;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

export const getUsers = async (req: AuthRequest, res: Response) => {
  // Gets all Users
  try {
    // An unbounded `limit` let one request pull the entire user table.
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || 20));

    const users = await prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      // `email` is deliberately not selected: this is a directory listing for every
      // authenticated user, and it was handing out the address of every account.
      select: {
        id: true,
        username: true,
        name: true,
        accountType: true,
        profileImageUrl: true,
        createdAt: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error("getUsers error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  // Gets a specific User
  try {
    const id = req.params.id as string;

    // Callers other than the account owner get the public shape (no email).
    const isSelf = req.user?.userId === id;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...(isSelf ? userPrivateSelect : userPublicSelect),
        crafts: userCraftsSelect,
        bandMemberships: { include: { band: true } },
        venueReps: { include: { venue: true } },
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("getUserById error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

const MAX_CRAFTS = 6;
const MAX_HEADLINE = 120;

/** A craft label describing what someone does, for list subtitles. */
const craftLabel = (craft: string) =>
  craft
    .toLowerCase()
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const peopleSubtitle = (crafts: { craft: string; forHire: boolean }[]) => {
  if (crafts.length === 0) return "";
  const primary = craftLabel(crafts[0].craft);
  return crafts.some(c => c.forHire) ? `${primary} · For hire` : primary;
};

/**
 * GET /users/discover
 *
 * Authenticated. Finding the photographers, promoters and sound engineers in a
 * scene. `GET /users` is already behind auth, and a public people-search over
 * city plus "for hire" is a different privacy posture again, so this stays authed.
 *
 *   ?craft=<csv>  ?forHire=  ?city= &state=  ?sceneSlug=  ?q=  ?page= &limit=
 */
export const discoverUsers = async (req: AuthRequest, res: Response) => {
  try {
    const page = parsePage(req.query.page);
    const limit = clampLimit(req.query.limit);
    const forHire = parseBool(req.query.forHire);
    const q = parseText(req.query.q);
    const city = parseText(req.query.city);
    const state = parseText(req.query.state);
    const sceneSlug = parseText(req.query.sceneSlug);

    const craftTokens = parseCsv(req.query.craft, MAX_CRAFTS);
    const valid = Object.values(Craft) as string[];
    const invalid = craftTokens.filter(c => !valid.includes(c.toUpperCase()));
    if (invalid.length) {
      return res.status(400).json({ error: `Invalid craft: ${invalid.join(", ")}` });
    }
    const crafts = craftTokens.map(c => c.toUpperCase() as Craft);

    const where: any = { deletedAt: null };

    if (sceneSlug) {
      const scene = await prisma.scene.findUnique({
        where: { slug: sceneSlug },
        select: { id: true },
      });
      // Unknown scene is an empty result, not a 404: this is a filter.
      if (!scene) return res.json({ people: [], page, limit, hasMore: false });
      where.sceneId = scene.id;
    }

    if (city) where.city = { equals: city, mode: "insensitive" };
    if (state) where.state = { in: stateSpellings(state), mode: "insensitive" };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ];
    }

    const craftFilter: any = {};
    if (crafts.length) craftFilter.craft = { in: crafts };
    if (forHire !== undefined) craftFilter.forHire = forHire;

    // Discovery is about people who have said what they do, so a craft is required
    // to appear here at all.
    where.crafts = { some: craftFilter };

    const people = await prisma.user.findMany({
      where,
      // Explicit select, never include: include on a User returns the password hash.
      select: {
        id: true,
        username: true,
        name: true,
        accountType: true,
        bio: true,
        city: true,
        state: true,
        profileImageUrl: true,
        crafts: userCraftsSelect,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      people: people.map(p => ({ ...p, subtitle: peopleSubtitle(p.crafts) })),
      page,
      limit,
      hasMore: people.length === limit,
    });
  } catch (error: any) {
    fail(res, error, "users");
  }
};

/**
 * PUT /users/:id/crafts
 *
 * Self only. canActAs is for polymorphic profiles; a user's own crafts are plain
 * identity, so this compares against the token's userId directly. "me" is
 * accepted as an alias, matching PUT /users/me.
 *
 * Replaces the whole set, so sending a shorter array is the "undo" operation --
 * which is why the refusal test covers removal, not just addition.
 */
export const updateUserCrafts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const target = req.params.id as string;
    if (target !== "me" && target !== userId) {
      return res.status(403).json({ error: "You can only change your own crafts" });
    }

    const { crafts } = req.body as {
      crafts?: { craft?: string; forHire?: boolean; headline?: string }[];
    };

    if (!Array.isArray(crafts)) {
      return res.status(400).json({ error: "crafts must be an array" });
    }
    if (crafts.length > MAX_CRAFTS) {
      return res.status(400).json({ error: `At most ${MAX_CRAFTS} crafts` });
    }

    const valid = Object.values(Craft) as string[];
    const seen = new Set<string>();
    const rows: { craft: Craft; forHire: boolean; headline: string | null; position: number }[] = [];

    for (const [position, entry] of crafts.entries()) {
      const craft = typeof entry?.craft === "string" ? entry.craft.toUpperCase() : "";
      if (!valid.includes(craft)) {
        return res.status(400).json({ error: `Invalid craft: ${entry?.craft ?? ""}` });
      }
      if (seen.has(craft)) {
        return res.status(400).json({ error: `Duplicate craft: ${craft}` });
      }
      seen.add(craft);

      if (entry.headline !== undefined && entry.headline !== null) {
        if (typeof entry.headline !== "string" || entry.headline.length > MAX_HEADLINE) {
          return res.status(400).json({ error: `headline must be at most ${MAX_HEADLINE} characters` });
        }
      }

      rows.push({
        craft: craft as Craft,
        forHire: entry.forHire === true,
        headline: entry.headline?.trim() || null,
        position,
      });
    }

    await prisma.$transaction([
      prisma.userCraft.deleteMany({ where: { userId } }),
      prisma.userCraft.createMany({ data: rows.map(r => ({ ...r, userId })) }),
    ]);

    res.json({
      crafts: await prisma.userCraft.findMany({
        where: { userId },
        select: { craft: true, forHire: true, headline: true },
        orderBy: { position: "asc" },
      }),
    });
  } catch (error: any) {
    fail(res, error, "users");
  }
};

export const getUserByUsername = async (req: AuthRequest, res: Response) => {
    try {
      const username = req.params.username as string;

      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          ...userPublicSelect,
          crafts: userCraftsSelect,
          bandMemberships: { include: { band: true } },
          venueReps: { include: { venue: true } },
        }
      })

      if (!user) return res.status(404).json({ error: "User not found" });

      res.json(user);
    } catch (error) {
      // The raw error object used to be serialised into the response body.
      console.error("getUserByUsername error:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
}

export const getMyProfiles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const bands = await prisma.band.findMany({
      where: { members: { some: { userId } }, deletedAt: null },
      select: { 
        id: true,
        name: true,
        city: true, 
        state: true,
        country: true,
        bio: true,
        profileImageUrl: true,
        headerImageUrl: true,
        accountType: true,
        genres: bandGenresSelect,
      }
    })

    const venues = await prisma.venue.findMany({
      where: { representatives: { some: { userId } }, deletedAt: null },
      select: { 
        id: true,
        name: true,
        city: true, 
        state: true,
        country: true,
        address: true,
        bio: true,
        profileImageUrl: true,
        headerImageUrl: true,
        accountType: true
      }
    })

    res.status(200).json({ bands: bands.map(flattenGenres), venues });
  }
  catch (error) {
    console.error("getMyProfiles error:", error);
    res.status(500).json({ error: "Failed to get profiles"})
  }
  
}

export const getMyInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const [bandInvites, venueInvites] = await Promise.all([
      prisma.bandInvite.findMany({
        where: {
          userId,
          status: "PENDING"
        },
        include: { band: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.venueInvite.findMany({
        where: {
          userId,
          status: "PENDING"
        },
        include: { venue: true },
        orderBy: { createdAt: "desc" }
      })
    ])

    res.json({ bandInvites, venueInvites })

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invites" })
  }
}

export const getMyBandInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const bandInvites = await prisma.bandInvite.findMany({
      where: {
        userId,
        status: "PENDING"
      },
      include: { band: true },
      orderBy: { createdAt: "desc" }
    })

    res.json({ bandInvites })

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch band invites" })
  }
}

export const getMyVenueInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    const venueInvites = await prisma.venueInvite.findMany({
      where: {
        userId,
        status: "PENDING"
      },
      include: { venue: true },
      orderBy: { createdAt: "desc" }
    })

    res.json({ venueInvites })

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch venue invites" })
  }
}

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      username,
      name,
      email,
      password,
      currentPassword,
      bio,
      city,
      state,
      country,
      removeBandId,
      removeVenueId
    } = req.body;

    const files = req.files as Record<string, Express.Multer.File[]>;

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    // Changing the password requires proving knowledge of the old one, so a stolen
    // or leaked token cannot be used to lock the real owner out of their account.
    if (password) {
      if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }
      if (!currentPassword || !(await bcrypt.compare(currentPassword, currentUser.password))) {
        return res.status(403).json({ error: "Current password is incorrect" });
      }
    }

    // Keep sceneId tracking the user's current city/state. Partial update, so
    // resolve against the merged location; done outside the transaction because
    // it may create a Scene row.
    const sceneId =
      city || state || country
        ? await resolveSceneId({
            city: city ?? currentUser.city,
            state: state ?? currentUser.state,
            country: country ?? currentUser.country,
          })
        : undefined;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updateData: any = {}

      if (username) updateData.username = username;
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (bio) updateData.bio = bio;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (country) updateData.country = country;
      if (sceneId !== undefined) updateData.sceneId = sceneId;


      if (files?.profileImage?.[0]) {
        if (currentUser?.profileImageUrl) {
          // Deletes old profile image
          const oldPath = path.join(__dirname, "../../", currentUser.profileImageUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        updateData.profileImageUrl = `/uploads/${files.profileImage[0].filename}`;
      }

      if (files?.headerImage?.[0]) {
        if (currentUser?.headerImageUrl) {
          // Deletes old header image
          const oldPath = path.join(__dirname, "../../", currentUser.headerImageUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        updateData.headerImageUrl = `/uploads/${files.headerImage[0].filename}`;
      }

      if (password) {
        updateData.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
      }

      // remove user from band
      if (removeBandId) {
        // check if user is in band
        const membership = await tx.bandMember.findFirst({
          where: {
            userId,
            bandId: removeBandId
          }
        });

        if (!membership) {
          throw new Error("Not a member of this band");
        }

        // leave band
        await tx.bandMember.deleteMany({
          where: {
            userId,
            bandId: removeBandId
          }
        });
      }

      // remove user from venue
      if (removeVenueId) {
        // check if user is in venue
        const membership = await tx.venueRepresentative.findFirst({
          where: {
            userId,
            venueId: removeVenueId
          }
        });

        if (!membership) {
          throw new Error("Not a member of this venue");
        }

        // leave venue
        await tx.venueRepresentative.deleteMany({
          where: {
            userId,
            venueId: removeVenueId
          }
        });
      }

      // update user information
      const user = await tx.user.update({
        where: { id: userId },
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

  } catch (error: any) {
    if (error?.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      return res.status(409).json({ error: `That ${target} is already taken` });
    }
    if (error?.message === "Not a member of this band" || error?.message === "Not a member of this venue") {
      return res.status(403).json({ error: error.message });
    }
    console.error("updateUser error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};


export const respondToBandInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const inviteId = req.params.id as string;
    const { action } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch the invite by its ID
    const invite = await prisma.bandInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.userId !== userId) return res.status(403).json({ error: "Not your invite" });

    if (invite.status !== "PENDING") {
      return res.status(400).json({ error: "Invite already responded to" });
    }

    if (action === "ACCEPT") {
      await prisma.$transaction(async (tx) => {
        // Add the user as a member
        await tx.bandMember.create({
          data: { bandId: invite.bandId, userId, role: "MEMBER" },
        });

        // Update invite to be ACCEPTED
        await tx.bandInvite.update({
          where: { id: inviteId },
          data: { status: InviteStatus.ACCEPTED }
        });
      });
    }

    else if (action === "DECLINE") {
      // Update invite to be DECLINED
      await prisma.bandInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.DECLINED }
      });
    }

    else { return res.status(400).json({ error: "Invalid action, must be ACCEPT or DECLINE" }) }

    const updatedBand = await prisma.band.findUnique({
      where: { id: invite.bandId },
      include: { members: true },
    });

    res.status(200).json(updatedBand);
  } catch (error: any) {
    fail(res, error, "respondToBandInvite");
  }
};

export const respondToVenueInvite = async (req: AuthRequest, res: Response) => {
  try {
    const inviteId = req.params.id as string;
    const { action } = req.body;
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

    if (action === "ACCEPT") {
      await prisma.$transaction(async (tx) => {
        // Add as representative
        await tx.venueRepresentative.create({
          data: {
            userId: userId!,
            venueId: invite.venueId
          }
        });

        // Update invite to be ACCEPTED
        await tx.venueInvite.update({
          where: { id: inviteId },
          data: { status: InviteStatus.ACCEPTED }
        });

      });
    }

    else if (action === "DECLINE") {
      await prisma.venueInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.DECLINED }
      });
    }

    else { return res.status(400).json({ error: "Invalid action, must be ACCEPT or DECLINE" }) }

    // Fetch updated venue with representatives
    const updatedVenue = await prisma.venue.findUnique({
      where: { id: invite.venueId },
      include: { representatives: true }
    });

    res.json(updatedVenue);

  } catch (error) {
    console.error("respondToVenueInvite error:", error);
    res.status(500).json({ error: "Failed to respond to venue invite" });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.user?.userId as string;

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
        where: { senderUserId: id },
        data: { senderUserId: null }
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