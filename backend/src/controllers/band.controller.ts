import 'dotenv/config';
import { prisma } from '../lib/prisma'
import { fail } from '../middlewares/error.middleware'
import { BandRole, InviteStatus } from '../../generated/prisma/client'
import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware';
import { resolveSceneId, stateSpellings } from '../lib/scenes';
import { resolveGenreIds, parseBandGenres } from '../lib/genres';
import { bandGenresSelect, flattenGenres, userPublicSelect } from '../lib/prismaSelects';
import { clampLimit, parsePage, parseCsv, parseText } from '../lib/query';
import { request } from 'node:http';
import fs from 'fs';
import path from 'path';

/**
 * GET /bands
 *
 * ?search= &city= &state= &sceneSlug= &excludeId= &page= &limit=
 * ?genre= csv of slugs, display names or aliases (genreSlugs is an alias)
 *
 * Response stays a bare array -- several screens bind to it directly.
 */
export const getBands = async (req: AuthRequest, res: Response) => {
  try {
    const page = parsePage(req.query.page);
    // Was `Number(req.query.limit) || 20` with no ceiling, which made ?limit=999999
    // a bulk export of the band table.
    const limit = clampLimit(req.query.limit);

    const search = parseText(req.query.search);
    const city = parseText(req.query.city);
    const state = parseText(req.query.state);
    const sceneSlug = parseText(req.query.sceneSlug);
    const excludeId = parseText(req.query.excludeId, 64);

    const genreTokens = [
      ...parseCsv(req.query.genre, 5),
      ...parseCsv(req.query.genreSlugs, 5),
    ];

    const where: any = { deletedAt: null };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (state) where.state = { in: stateSpellings(state), mode: 'insensitive' };
    // The frontend has been sending excludeId all along and it was silently ignored.
    if (excludeId) where.id = { not: excludeId };

    if (sceneSlug) {
      const scene = await prisma.scene.findUnique({
        where: { slug: sceneSlug },
        select: { id: true },
      });
      if (!scene) return res.json([]);
      where.sceneId = scene.id;
    }

    if (genreTokens.length) {
      // Was `where.genre = { contains: genre }` against the free-text column, so
      // ?genre=Rock also matched every band tagged "Punk Rock". Genre membership
      // is now an explicit taxonomy decision rather than a substring accident.
      const genreIds = await resolveGenreIds(genreTokens);
      if (genreIds.length === 0) return res.json([]);
      where.genres = { some: { genreId: { in: genreIds } } };
    }

    const bands = await prisma.band.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        country: true,
        profileImageUrl: true,
        // Clients route a row off this; see the same field on GET /venues.
        accountType: true,
        createdAt: true,
        genres: {
          select: { position: true, genre: { select: { slug: true, name: true } } },
          orderBy: { position: 'asc' },
        },
      }
    });

    res.json(bands.map(b => ({ ...b, genres: b.genres.map(g => g.genre) })))
  } catch (error: any) {
    console.error("Prisma getBands error:", error.message)
    fail(res, error, "band")
  }
}

export const getBandById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string

    const band = await prisma.band.findUnique({
      where: { id, deletedAt: null },
      include: {
        // Public route: select, never include, on User. `user: true` handed every
        // member's email and password hash to anyone without a token.
        members: { include: { user: { select: userPublicSelect } } },
        tours: { include: { tour: true } },
        shows: { include: { show: { include: { venue: true, tour: true } } } },
        genres: bandGenresSelect,
      }
    })

    if (!band) {
      return res.status(404).json({ error: "Band not found" })
    }

    res.json(flattenGenres(band))
  } catch (error: any) {
    console.error("Prisma getBandById error:", error.message)
    fail(res, error, "band")
  }
}

export const getMyShowInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Find all bands the user is a member of
    const userBands = await prisma.bandMember.findMany({
      where: { userId },
      select: { bandId: true },
    });

    const bandIds = userBands.map((b) => b.bandId);
    if (!bandIds.length) return res.json([]); // user in no bands

    // Fetch show invites for those bands
    const invites = await prisma.showInvite.findMany({
      where: { bandId: { in: bandIds }, status: InviteStatus.PENDING },
      select: {
        id: true,
        showId: true,
        bandId: true,
        venueId: true,
        status: true,
        createdAt: true,
        band: { select: { id: true, name: true, profileImageUrl: true } },
        show: { select: { id: true, date: true, city: true, state: true, country: true, posterUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(invites);
  } catch (error: any) {
    console.error("Prisma getMyShowInvites error:", error.message);
    fail(res, error, "band");
  }
};

export const createBand = async (req: AuthRequest, res: Response) => {
  try {
    const { name, city, state, country, bio, members } = req.body;
    const creatorId = req.user?.userId;

    const files = req.files as Record<string, Express.Multer.File[]>;

    const profileImageUrl = files?.profileImage?.[0]
      ? `/uploads/${files.profileImage[0].filename}`
      : undefined;

    const headerImageUrl = files?.headerImage?.[0]
      ? `/uploads/${files.headerImage[0].filename}`
      : undefined;

    if (!creatorId) return res.status(401).json({ error: "Unauthorized" });
    if (!name) return res.status(400).json({ error: "Band name is required." });

    // Validated before resolveSceneId, which can create a Scene row: a rejected
    // request must not leave anything behind.
    const bandGenres = await parseBandGenres(req.body.genres);
    if (bandGenres.error) return res.status(400).json({ error: bandGenres.error });

    const accountType = "BAND";

    // Resolved outside the transaction: it may create a Scene row, and holding
    // that inside the band transaction would widen the window for a write race.
    const sceneId = await resolveSceneId({ city, state, country });

    const band = await prisma.$transaction(async (tx) => {
      // 1. Create band + creator as member (ONLY ONCE)
      const createdBand = await tx.band.create({
        data: {
          name,
          city,
          state,
          country,
          sceneId,
          accountType,
          bio,
          profileImageUrl,
          headerImageUrl,
          ...(bandGenres.genreIds?.length
            ? { genres: { create: bandGenres.genreIds.map((genreId, position) => ({ genreId, position })) } }
            : {}),
          members: {
            create: [
              {
                userId: creatorId,
                role: "MANAGER"
              },
            ],
          },
        },
        include: {
          members: {
            include: {
              user: { select: { name: true, id: true } },
            },
          },
          tours: { include: { tour: true } },
          shows: { include: { show: true } },
          genres: bandGenresSelect,
        },
      });

      // 2. Create invites (bulk)
      if (members && Array.isArray(members)) {
        const invites = members
          .filter((m: any) => m.userId && m.userId !== creatorId)
          .map((m: any) => ({
            bandId: createdBand.id,
            userId: m.userId,
            status: InviteStatus.PENDING,
          }));

        if (invites.length > 0) {
          await tx.bandInvite.createMany({
            data: invites,
          });
        }
      }

      return createdBand;
    });

    res.status(201).json(flattenGenres(band));
  } catch (error: any) {
    console.error("Prisma createBand error:", error.message);
    fail(res, error, "band");
  }
};

export const updateBand = async (req: AuthRequest, res: Response) => {
  try {
    const bandId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, city, state, country, bio, updateRole, inviteMemberId, removeMemberId }:
      {
        name?: string;
        city?: string;
        state?: string;
        country?: string;
        bio?: string;
        updateRole?: { userId: string; bandRole: BandRole };
        inviteMemberId?: string;
        removeMemberId?: string;
      } = req.body;

    const files = req.files as Record<string, Express.Multer.File[]>;

    // Only members may edit the band at all. Without this, any authenticated user
    // could rewrite any band's name, bio and images.
    const requesterMembership = await prisma.bandMember.findUnique({
      where: { userId_bandId: { userId, bandId } }
    });
    if (!requesterMembership) {
      return res.status(403).json({ error: "Not a member of this band" });
    }
    const isManager = requesterMembership.role === "MANAGER";

    // Roster changes are manager-only.
    if ((removeMemberId || inviteMemberId || updateRole) && !isManager) {
      return res.status(403).json({ error: "Only managers can change the band roster" });
    }

    // Any member may set genres, like name and bio. Validated before anything is
    // written, so a bad slug leaves the existing set untouched.
    const bandGenres = await parseBandGenres(req.body.genres);
    if (bandGenres.error) return res.status(400).json({ error: bandGenres.error });

    const currentBand = await prisma.band.findUnique({ where: { id: bandId } });

    // sceneId must track the band's current city/state. Resolve against the
    // merged location, since this is a partial update -- passing only `city`
    // still moves the band to a different scene.
    const sceneId =
      city || state || country
        ? await resolveSceneId({
            city: city ?? currentBand?.city,
            state: state ?? currentBand?.state,
            country: country ?? currentBand?.country,
          })
        : undefined;

    const updatedBand = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (country) updateData.country = country;
      if (bio) updateData.bio = bio;
      if (sceneId !== undefined) updateData.sceneId = sceneId;

      if (files?.profileImage?.[0]) {
        if (currentBand?.profileImageUrl) {
          // Deletes old profile image
          const oldPath = path.join(__dirname, "../../", currentBand.profileImageUrl);
          if (fs.existsSync(oldPath)) { fs.unlinkSync(oldPath); }
        }
        updateData.profileImageUrl = `/uploads/${files.profileImage[0].filename}`;
      }
      if (files?.headerImage?.[0]) {
        if (currentBand?.headerImageUrl) {
          // Deletes old header image
          const oldPath = path.join(__dirname, "../../", currentBand.headerImageUrl);
          if (fs.existsSync(oldPath)) { fs.unlinkSync(oldPath); }
        }
        updateData.headerImageUrl = `/uploads/${files.headerImage[0].filename}`;
      }

      // Remove a member (manager-only; checked before the transaction)
      if (removeMemberId) {
        await tx.bandMember.delete({
          where: { userId_bandId: { userId: removeMemberId, bandId } }
        });
      }

      // Invite new member if provided
      if (inviteMemberId) {
        const existingMember = await tx.bandMember.findUnique({
          where: { userId_bandId: { userId: inviteMemberId, bandId } }
        });
        const existingInvite = await tx.bandInvite.findFirst({
          where: {
            bandId,
            userId: inviteMemberId,
            status: "PENDING"
          }
        });

        if (!existingMember && !existingInvite) {
          await tx.bandInvite.create({ data: { bandId, userId: inviteMemberId } });
        }
      }

      // Update member's role if provided (manager-only; checked before the transaction)
      if (updateRole) {
        await tx.bandMember.update({
          where: { userId_bandId: { userId: updateRole.userId, bandId } },
          data: { role: updateRole.bandRole }
        });
      }

      // Replace-the-set semantics, as PUT /users/me/crafts: omitted leaves it
      // alone, [] clears it, otherwise the given order becomes `position`.
      if (bandGenres.genreIds) {
        await tx.bandGenre.deleteMany({ where: { bandId } });
        if (bandGenres.genreIds.length) {
          await tx.bandGenre.createMany({
            data: bandGenres.genreIds.map((genreId, position) => ({ bandId, genreId, position })),
          });
        }
      }

      const band = await tx.band.update({
        where: { id: bandId },
        data: updateData,
        include: {
          members: { include: { user: { select: { name: true, id: true } } } },
          tours: { include: { tour: true } },
          shows: { include: { show: true } },
          genres: bandGenresSelect,
        }
      });

      return {
        ...flattenGenres(band),
        tours: band.tours.map(bt => bt.tour),
        shows: band.shows.map(sb => sb.show)
      };
    });

    res.status(200).json(updatedBand);

  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") return res.status(404).json({ error: "Band not found" });
    fail(res, error, "band");
  }
};

export const respondToShowInvite = async (req: AuthRequest, res: Response) => {
  try {
    const showInviteId = req.params.id as string;
    const { action } = req.body; // ACCEPT or DECLINE
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch the invite and band members
    const invite = await prisma.showInvite.findUnique({
      where: { id: showInviteId },
      include: { band: { include: { members: true } } },
    });

    if (!invite) return res.status(404).json({ error: "Invite not found" });

    if (!invite.bandId) {
      return res.status(400).json({ error: "This invite is not for a band" });
    }

    const bandId = invite.bandId;

    // Check if current user is in the band
    const isBandMember = invite.band?.members.some((m) => m.userId === userId);
    if (!isBandMember) return res.status(403).json({ error: "Not a band member" });

    if (action === "ACCEPT") {
      // Add band to the show
      await prisma.$transaction(async (tx) => {
        await tx.showBand.create({
          data: {
            showId: invite.showId,
            bandId: bandId
          }
        });

        // Update invite status
        await tx.showInvite.update({
          where: { id: showInviteId },
          data: { status: InviteStatus.ACCEPTED },
        });
      })

    } else if (action === "DECLINE") {
      await prisma.showInvite.update({
        where: { id: showInviteId },
        data: { status: InviteStatus.DECLINED },
      });
    } else {
      return res.status(400).json({ error: "Invalid action, must be ACCEPT or DECLINE" });
    }

    // Return updated show 
    const updatedShow = await prisma.show.findUnique({
      where: { id: invite.showId },
      include: { bands: true },
    });

    res.status(200).json(updatedShow);
  } catch (error: any) {
    console.error("Prisma respondToShowInvite error:", error.message);
    fail(res, error, "band");
  }
};

export const respondToTourInvite = async (req: AuthRequest, res: Response) => {
  try {
    const tourInviteId = req.params.id as string;
    const { action } = req.body; // ACCEPT or DECLINE
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch the invite and band members
    const invite = await prisma.tourInvite.findUnique({
      where: { id: tourInviteId },
      include: { band: { include: { members: true } } },
    });

    if (!invite) return res.status(404).json({ error: "Invite not found" });

    // Check if current user is in the band
    const isBandMember = invite.band.members.some((m) => m.userId === userId);
    if (!isBandMember) return res.status(403).json({ error: "Not a band member" });

    if (action === "ACCEPT") {
      // Add band to the tour
      await prisma.$transaction(async (tx) => {
        await tx.bandTour.create({
          data: {
            tourId: invite.tourId,
            bandId: invite.bandId,
          },
        });

        // Update invite status
        await tx.tourInvite.update({
          where: { id: tourInviteId },
          data: { status: InviteStatus.ACCEPTED },
        });
      })

    } else if (action === "DECLINE") {
      await prisma.tourInvite.update({
        where: { id: tourInviteId },
        data: { status: InviteStatus.DECLINED },
      });
    } else {
      return res.status(400).json({ error: "Invalid action, must be ACCEPT or DECLINE" });
    }

    // Return updated show 
    const updatedTour = await prisma.tour.findUnique({
      where: { id: invite.tourId },
      include: { bands: true },
    });

    res.status(200).json(updatedTour);
  } catch (error: any) {
    console.error("Prisma respondToTourInvite error:", error.message);
    fail(res, error, "band");
  }
};

export const deleteBand = async (req: AuthRequest, res: Response) => {
  try {
    const bandId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await prisma.$transaction(async (tx) => {

      // Check if requester is a manager of this band
      const membership = await tx.bandMember.findFirst({
        where: {
          bandId,
          userId
        }
      });

      if (!membership) {
        throw new Error("Not a member of this band");
      }

      if (membership.role !== "MANAGER") {
        throw new Error("Only band managers can delete the band");
      }

      // Remove relationships
      await tx.bandMember.deleteMany({ where: { bandId } });
      await tx.bandTour.deleteMany({ where: { bandId } });
      await tx.showBand.deleteMany({ where: { bandId } });

      // Soft delete band
      await tx.band.update({
        where: { id: bandId },
        data: { deletedAt: new Date() }
      });

    });

    res.json({ message: "Band soft-deleted successfully" });

  } catch (error: any) {
    console.error("Prisma deleteBand error:", error.message);

    if (error.message === "Not a member of this band") {
      return res.status(403).json({ error: error.message });
    }

    if (error.message === "Only band managers can delete the band") {
      return res.status(403).json({ error: error.message });
    }

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Band not found" });
    }

    fail(res, error, "band");
  }
};