import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ListingKind, ListingStatus } from "../../generated/prisma/client";

// Shared owner selection so listings always carry a resolvable lister summary
const ownerInclude = {
  createdByUser: { select: { id: true, name: true, username: true, profileImageUrl: true } },
  createdByBand: { select: { id: true, name: true, profileImageUrl: true } },
  createdByVenue: { select: { id: true, name: true, profileImageUrl: true } },
};

// Helper: can this user manage (edit/delete) the listing?
const canManageListing = async (listingId: string, userId: string) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      createdByBand: { include: { members: true } },
      createdByVenue: { include: { representatives: true } },
    },
  });

  if (!listing) return false;

  if (listing.createdByUserId === userId) return true;
  if (listing.createdByBand?.members.some(m => m.userId === userId)) return true;
  if (listing.createdByVenue?.representatives.some(r => r.userId === userId)) return true;

  return false;
};

const parseBool = (v: unknown) => v === true || v === "true";

// READ

export const getListings = async (req: Request, res: Response) => {
  try {
    const { city, state, kind, category, openToTrades, maxPrice, search } = req.query as Record<string, string | undefined>;

    const where: any = { deletedAt: null, status: ListingStatus.ACTIVE };

    if (city)  where.city  = { equals: city,  mode: "insensitive" };
    if (state) where.state = { equals: state, mode: "insensitive" };
    if (kind === "RENT" || kind === "SALE") where.kind = kind;
    if (category) where.category = { equals: category, mode: "insensitive" };
    if (openToTrades === "true") where.openToTrades = true;
    if (maxPrice && !isNaN(Number(maxPrice))) where.price = { lte: Number(maxPrice) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const listings = await prisma.listing.findMany({
      where,
      include: ownerInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json(listings);
  } catch (error: any) {
    fail(res, error, "listing");
  }
};

export const getListingById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const listing = await prisma.listing.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...ownerInclude,
        media: { where: { deletedAt: null }, orderBy: { position: "asc" } },
      },
    });

    if (!listing) return res.status(404).json({ error: "Listing not found" });

    res.json(listing);
  } catch (error: any) {
    fail(res, error, "listing");
  }
};

// Listings owned by a specific profile (powers the profile listings section)
export const getListingsByProfile = async (req: Request, res: Response) => {
  try {
    const { userId, bandId, venueId, includeClosed } = req.query as Record<string, string | undefined>;

    const where: any = { deletedAt: null };
    if (includeClosed !== "true") where.status = ListingStatus.ACTIVE;

    if (bandId) where.createdByBandId = bandId;
    else if (venueId) where.createdByVenueId = venueId;
    else if (userId) where.createdByUserId = userId;
    else return res.status(400).json({ error: "userId, bandId, or venueId is required" });

    const listings = await prisma.listing.findMany({
      where,
      include: ownerInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json(listings);
  } catch (error: any) {
    fail(res, error, "listing");
  }
};

// CREATE

export const createListing = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      title, description, category, kind, price, openToTrades,
      city, state, country, latitude, longitude,
      creatorUserId, creatorBandId, creatorVenueId,
    } = req.body as Record<string, string | undefined>;

    if (!title || !description || !city) {
      return res.status(400).json({ error: "title, description, and city are required" });
    }

    // Exactly one creator
    const creatorCount = [creatorUserId, creatorBandId, creatorVenueId].filter(v => v).length;
    if (creatorCount !== 1) {
      return res.status(400).json({ error: "There must be exactly one creator of a listing" });
    }

    // Authorization for the chosen creator
    if (creatorUserId && creatorUserId !== userId) {
      return res.status(403).json({ error: "You must be the creator user" });
    }
    if (creatorBandId) {
      const membership = await prisma.bandMember.findFirst({ where: { bandId: creatorBandId, userId } });
      if (!membership) return res.status(403).json({ error: "You must be a member of the creator band" });
    }
    if (creatorVenueId) {
      const rep = await prisma.venueRepresentative.findFirst({ where: { venueId: creatorVenueId, userId } });
      if (!rep) return res.status(403).json({ error: "You must be a representative of the creator venue" });
    }

    const coverUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        category: category || null,
        kind: kind === "SALE" ? ListingKind.SALE : ListingKind.RENT,
        price: price != null && price !== "" ? Number(price) : null,
        openToTrades: parseBool(openToTrades),
        coverUrl,
        city,
        state: state || null,
        country: country || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        createdByUserId: creatorUserId || null,
        createdByBandId: creatorBandId || null,
        createdByVenueId: creatorVenueId || null,
      },
      include: ownerInclude,
    });

    res.status(201).json(listing);
  } catch (error: any) {
    fail(res, error, "listing");
  }
};

// UPDATE

export const updateListing = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageListing(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const {
      title, description, category, kind, price, openToTrades,
      city, state, country, latitude, longitude, status,
    } = req.body as Record<string, string | undefined>;

    const coverUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const listing = await prisma.listing.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category: category || null }),
        ...(kind !== undefined && { kind: kind === "SALE" ? ListingKind.SALE : ListingKind.RENT }),
        ...(price !== undefined && { price: price !== "" ? Number(price) : null }),
        ...(openToTrades !== undefined && { openToTrades: parseBool(openToTrades) }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state: state || null }),
        ...(country !== undefined && { country: country || null }),
        ...(latitude !== undefined && { latitude: latitude ? Number(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? Number(longitude) : null }),
        ...(status && Object.values(ListingStatus).includes(status as ListingStatus) && { status: status as ListingStatus }),
        ...(coverUrl && { coverUrl }),
      },
      include: ownerInclude,
    });

    res.json(listing);
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Listing not found" });
    fail(res, error, "listing");
  }
};

// Change status (mark claimed/closed/reactivate)
export const setListingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageListing(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const { status } = req.body as { status?: string };
    if (!status || !Object.values(ListingStatus).includes(status as ListingStatus)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: { status: status as ListingStatus },
      include: ownerInclude,
    });

    res.json(listing);
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Listing not found" });
    fail(res, error, "listing");
  }
};

// DELETE (soft)

export const deleteListing = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageListing(id, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    await prisma.listing.update({ where: { id }, data: { deletedAt: new Date() } });

    res.json({ message: "Listing deleted" });
  } catch (error: any) {
    if (error.code === "P2025") return res.status(404).json({ error: "Listing not found" });
    fail(res, error, "listing");
  }
};

// MEDIA

export const getListingMedia = async (req: Request, res: Response) => {
  try {
    const listingId = req.params.id as string;
    const media = await prisma.listingMedia.findMany({
      where: { listingId, deletedAt: null },
      orderBy: { position: "asc" },
    });
    res.json(media);
  } catch (error: any) {
    fail(res, error, "listing");
  }
};

export const addListingMedia = async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageListing(listingId, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: "No media file provided" });

    const { type } = req.body as { type?: string };

    // Append at the end of the current gallery order
    const last = await prisma.listingMedia.findFirst({
      where: { listingId, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const media = await prisma.listingMedia.create({
      data: {
        listingId,
        url: `/uploads/${file.filename}`,
        type: type === "VIDEO" ? "VIDEO" : "PHOTO",
        position: (last?.position ?? -1) + 1,
        uploaderUserId: userId,
      },
    });

    res.status(201).json(media);
  } catch (error: any) {
    fail(res, error, "listing");
  }
};

export const deleteListingMedia = async (req: AuthRequest, res: Response) => {
  try {
    const mediaId = req.params.mediaId as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const media = await prisma.listingMedia.findUnique({ where: { id: mediaId } });
    if (!media || media.deletedAt) return res.status(404).json({ error: "Media not found" });

    let allowed = media.uploaderUserId === userId;
    if (!allowed) allowed = await canManageListing(media.listingId, userId);
    if (!allowed) return res.status(403).json({ error: "Not allowed to delete this media" });

    await prisma.listingMedia.update({ where: { id: mediaId }, data: { deletedAt: new Date() } });
    res.json({ message: "Deleted" });
  } catch (error: any) {
    fail(res, error, "listing");
  }
};

// Reconcile the full photo order for a listing.
// `order` is a list of `/uploads/...` URLs; index 0 is the cover, the rest are the
// gallery in order. Every URL must already belong to this listing (its current cover
// or one of its media). Handles reorder, cover promotion/demotion, adds and removals.
export const reorderListingPhotos = async (req: AuthRequest, res: Response) => {
  try {
    const listingId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const allowed = await canManageListing(listingId, userId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const { order } = req.body as { order?: string[] };
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array of photo URLs" });

    const listing = await prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    const media = await prisma.listingMedia.findMany({ where: { listingId, deletedAt: null } });

    // Only URLs already belonging to this listing may be referenced
    const knownUrls = new Set<string>(media.map(m => m.url));
    if (listing.coverUrl) knownUrls.add(listing.coverUrl);
    for (const url of order) {
      if (typeof url !== "string" || !knownUrls.has(url)) {
        return res.status(400).json({ error: `Unknown photo URL: ${url}` });
      }
    }

    const desiredCover = order[0] ?? null;
    const desiredGallery = order.slice(1);
    const mediaByUrl = new Map(media.map(m => [m.url, m] as const));

    await prisma.$transaction(async (tx) => {
      await tx.listing.update({ where: { id: listingId }, data: { coverUrl: desiredCover } });

      // Position the gallery; create rows for URLs that aren't media yet (e.g. a demoted cover)
      for (let i = 0; i < desiredGallery.length; i++) {
        const url = desiredGallery[i];
        const existing = mediaByUrl.get(url);
        if (existing) {
          await tx.listingMedia.update({ where: { id: existing.id }, data: { position: i, deletedAt: null } });
        } else {
          await tx.listingMedia.create({
            data: { listingId, url, type: "PHOTO", position: i, uploaderUserId: userId },
          });
        }
      }

      // Soft-delete any media not in the desired gallery (removed, or promoted to cover)
      const keep = new Set(desiredGallery);
      for (const m of media) {
        if (!keep.has(m.url)) {
          await tx.listingMedia.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
        }
      }
    });

    const updated = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        ...ownerInclude,
        media: { where: { deletedAt: null }, orderBy: { position: "asc" } },
      },
    });

    res.json(updated);
  } catch (error: any) {
    fail(res, error, "listing");
  }
};
