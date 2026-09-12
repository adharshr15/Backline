import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../middlewares/error.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ParticipantType } from "../../generated/prisma/enums";
import { canManageShow } from "./show.controller";

// Slim profile fields for owner/author previews.
const profileSelect = { id: true, name: true, profileImageUrl: true, accountType: true } as const;

// Slim show fields for the "linked show" card on a post.
const showPreviewSelect = {
  id: true, posterUrl: true, date: true, city: true, state: true, venueName: true,
} as const;

// Shared include for returning a post with owner, linked show, and counts.
export const postInclude = {
  ownerUser:  { select: profileSelect },
  ownerBand:  { select: profileSelect },
  ownerVenue: { select: profileSelect },
  show:       { select: showPreviewSelect },
  _count:     { select: { comments: true, likes: true } },
} as const;

const commentInclude = {
  authorUser:  { select: profileSelect },
  authorBand:  { select: profileSelect },
  authorVenue: { select: profileSelect },
} as const;

const isValidType = (t: any): t is ParticipantType =>
  t === ParticipantType.USER || t === ParticipantType.BAND || t === ParticipantType.VENUE;

// Verify the logged-in user may act as the given profile (self / band member / venue rep).
async function canActAs(userId: string, type: ParticipantType, id: string): Promise<boolean> {
  if (type === ParticipantType.USER) return id === userId;
  if (type === ParticipantType.BAND) {
    return !!(await prisma.bandMember.findFirst({ where: { bandId: id, userId } }));
  }
  if (type === ParticipantType.VENUE) {
    return !!(await prisma.venueRepresentative.findFirst({ where: { venueId: id, userId } }));
  }
  return false;
}

const ownerField = (type: ParticipantType, id: string) =>
  type === ParticipantType.BAND  ? { ownerBandId: id } :
  type === ParticipantType.VENUE ? { ownerVenueId: id } :
                                   { ownerUserId: id };

// The owner's scene, for stamping a post that has no show to take one from.
async function ownerSceneId(type: ParticipantType, id: string): Promise<string | null> {
  const select = { sceneId: true } as const;
  const row =
    type === ParticipantType.BAND  ? await prisma.band.findUnique({ where: { id }, select }) :
    type === ParticipantType.VENUE ? await prisma.venue.findUnique({ where: { id }, select }) :
                                     await prisma.user.findUnique({ where: { id }, select });
  return row?.sceneId ?? null;
}

const authorField = (type: ParticipantType, id: string) =>
  type === ParticipantType.BAND  ? { authorBandId: id } :
  type === ParticipantType.VENUE ? { authorVenueId: id } :
                                   { authorUserId: id };

// Which post ids the given viewer profile has liked, from a candidate set.
async function likedPostIds(
  postIds: string[],
  viewerType?: string,
  viewerId?: string,
): Promise<Set<string>> {
  if (!viewerType || !viewerId || postIds.length === 0) return new Set();
  const likes = await prisma.postLike.findMany({
    where: { postId: { in: postIds }, likerType: viewerType, likerId: viewerId },
    select: { postId: true },
  });
  return new Set(likes.map(l => l.postId));
}

// POST /posts — create a post (optionally linked to a show). Multipart: `media`.
export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: "No media file provided" });

    const { ownerType, ownerId, type, caption, showId } = req.body as {
      ownerType?: string; ownerId?: string; type?: string; caption?: string; showId?: string;
    };

    if (!isValidType(ownerType) || !ownerId) {
      return res.status(400).json({ error: "ownerType and ownerId are required" });
    }
    if (!(await canActAs(userId, ownerType, ownerId))) {
      return res.status(403).json({ error: "You cannot post as this profile" });
    }
    // A post belongs to the scene it was taken in: the linked show's, else the owner's.
    let sceneId: string | null = null;
    if (showId) {
      const show = await prisma.show.findFirst({
        where: { id: showId, deletedAt: null },
        select: { sceneId: true },
      });
      if (!show) return res.status(404).json({ error: "Linked show not found" });
      sceneId = show.sceneId;
    }
    sceneId ??= await ownerSceneId(ownerType, ownerId);

    const post = await prisma.post.create({
      data: {
        url: `/uploads/${file.filename}`,
        type: type === "VIDEO" ? "VIDEO" : "PHOTO",
        caption: caption?.trim() || null,
        uploaderUserId: userId,
        sceneId,
        ...(showId ? { showId } : {}),
        ...ownerField(ownerType, ownerId),
      },
      include: postInclude,
    });

    res.status(201).json({ ...post, likedByViewer: false });
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// GET /posts?ownerType&ownerId&viewerType&viewerId — a profile's posts grid.
export const getProfilePosts = async (req: AuthRequest, res: Response) => {
  try {
    const { ownerType, ownerId, viewerType, viewerId } = req.query as {
      ownerType?: string; ownerId?: string; viewerType?: string; viewerId?: string;
    };
    if (!isValidType(ownerType) || !ownerId) {
      return res.status(400).json({ error: "ownerType and ownerId are required" });
    }

    const posts = await prisma.post.findMany({
      where: { ...ownerField(ownerType, ownerId), deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: postInclude,
    });

    const liked = await likedPostIds(posts.map(p => p.id), viewerType, viewerId);
    res.json(posts.map(p => ({ ...p, likedByViewer: liked.has(p.id) })));
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// GET /shows/:id/posts — posts linked to a show (the show's media gallery).
export const getShowPosts = async (req: Request, res: Response) => {
  try {
    const showId = req.params.id as string;
    const { viewerType, viewerId } = req.query as { viewerType?: string; viewerId?: string };

    const posts = await prisma.post.findMany({
      where: { showId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: postInclude,
    });

    const liked = await likedPostIds(posts.map(p => p.id), viewerType, viewerId);
    res.json(posts.map(p => ({ ...p, likedByViewer: liked.has(p.id) })));
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// GET /posts/:id?viewerType&viewerId — a single post with comments + like state.
export const getPost = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { viewerType, viewerId } = req.query as { viewerType?: string; viewerId?: string };

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...postInclude,
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: commentInclude,
        },
      },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const liked = await likedPostIds([post.id], viewerType, viewerId);
    res.json({ ...post, likedByViewer: liked.has(post.id) });
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// DELETE /posts/:id — uploader, owner, or a show manager may delete.
export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id as string;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) return res.status(404).json({ error: "Post not found" });

    let allowed = post.uploaderUserId === userId;
    if (!allowed && post.ownerBandId)  allowed = await canActAs(userId, ParticipantType.BAND, post.ownerBandId);
    if (!allowed && post.ownerVenueId) allowed = await canActAs(userId, ParticipantType.VENUE, post.ownerVenueId);
    if (!allowed && post.ownerUserId)  allowed = post.ownerUserId === userId;
    if (!allowed && post.showId)       allowed = await canManageShow(post.showId, userId);

    if (!allowed) return res.status(403).json({ error: "Not allowed to delete this post" });

    await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ message: "Deleted" });
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// POST /posts/:id/comments — add a comment as a profile.
export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = req.params.id as string;
    const { authorType, authorId, text } = req.body as {
      authorType?: string; authorId?: string; text?: string;
    };
    if (!isValidType(authorType) || !authorId || !text?.trim()) {
      return res.status(400).json({ error: "authorType, authorId, and text are required" });
    }
    if (!(await canActAs(userId, authorType, authorId))) {
      return res.status(403).json({ error: "You cannot comment as this profile" });
    }

    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = await prisma.postComment.create({
      data: {
        postId,
        text: text.trim(),
        commenterUserId: userId,
        ...authorField(authorType, authorId),
      },
      include: commentInclude,
    });
    res.status(201).json(comment);
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// DELETE /posts/comments/:commentId — commenter or post owner may delete.
export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const commentId = req.params.commentId as string;
    const comment = await prisma.postComment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!comment || comment.deletedAt) return res.status(404).json({ error: "Comment not found" });

    let allowed = comment.commenterUserId === userId;
    const post = comment.post;
    if (!allowed && post?.ownerBandId)  allowed = await canActAs(userId, ParticipantType.BAND, post.ownerBandId);
    if (!allowed && post?.ownerVenueId) allowed = await canActAs(userId, ParticipantType.VENUE, post.ownerVenueId);
    if (!allowed && post?.ownerUserId)  allowed = post.ownerUserId === userId;

    if (!allowed) return res.status(403).json({ error: "Not allowed to delete this comment" });

    await prisma.postComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    res.json({ message: "Deleted" });
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// POST /posts/:id/like — like as a profile (idempotent).
export const likePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = req.params.id as string;
    const { likerType, likerId } = req.body as { likerType?: string; likerId?: string };
    if (!isValidType(likerType) || !likerId) {
      return res.status(400).json({ error: "likerType and likerId are required" });
    }
    if (!(await canActAs(userId, likerType, likerId))) {
      return res.status(403).json({ error: "You cannot like as this profile" });
    }

    await prisma.postLike.upsert({
      where: { postId_likerType_likerId: { postId, likerType, likerId } },
      create: { postId, likerType, likerId },
      update: {},
    });

    const likeCount = await prisma.postLike.count({ where: { postId } });
    res.status(201).json({ liked: true, likeCount });
  } catch (error: any) {
    fail(res, error, "post");
  }
};

// DELETE /posts/:id/like?likerType&likerId — remove a like.
export const unlikePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const postId = req.params.id as string;
    const { likerType, likerId } = { ...req.body, ...req.query } as { likerType?: string; likerId?: string };
    if (!isValidType(likerType) || !likerId) {
      return res.status(400).json({ error: "likerType and likerId are required" });
    }
    if (!(await canActAs(userId, likerType, likerId))) {
      return res.status(403).json({ error: "You cannot unlike as this profile" });
    }

    await prisma.postLike.deleteMany({ where: { postId, likerType, likerId } });
    const likeCount = await prisma.postLike.count({ where: { postId } });
    res.json({ liked: false, likeCount });
  } catch (error: any) {
    fail(res, error, "post");
  }
};
