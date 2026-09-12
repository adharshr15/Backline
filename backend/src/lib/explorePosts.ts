import { prisma } from "./prisma";
import { profileSummarySelect } from "./prismaSelects";
import { rankPosts, PostCandidate } from "./postRanking";
import { ExploreContext, FOLLOW_SAMPLE } from "./exploreContext";

/**
 * Candidate gathering for the Explore post grids. The ordering itself is the
 * pure rankPosts(); this only decides which rows are worth ranking.
 *
 * Five bounded pools, fetched in parallel: local, followed owners, followed
 * scenes, genre match, and recent-anywhere as the fallback. A post's signals
 * are computed from its own row, not from which pool returned it, so a post
 * found by two pools scores exactly like one found by either.
 *
 * Everything is pinned to `asOf` -- the rows, the engagement counts, and the
 * clock used for decay -- so paging through the same cursor re-derives the same
 * order.
 */

const POOL_SIZE = 200;

const ownerSelect = { select: { ...profileSummarySelect, deletedAt: true } } as const;

const postSelect = (asOf: Date) =>
  ({
    id: true,
    url: true,
    type: true,
    caption: true,
    showId: true,
    sceneId: true,
    createdAt: true,
    ownerUserId: true,
    ownerBandId: true,
    ownerVenueId: true,
    ownerUser: ownerSelect,
    ownerVenue: ownerSelect,
    ownerBand: {
      select: { ...profileSummarySelect, deletedAt: true, genres: { select: { genreId: true } } },
    },
    _count: {
      select: {
        likes: { where: { createdAt: { lte: asOf } } },
        comments: { where: { createdAt: { lte: asOf }, deletedAt: null } },
      },
    },
  }) as const;

type PostWhere = NonNullable<NonNullable<Parameters<typeof prisma.post.findMany>[0]>["where"]>;

/**
 * Not the acting profile's own posts. Spelled as an OR because `not` on a
 * nullable column also drops the NULL rows -- which would be every post owned
 * by a different profile type.
 */
const notOwnedBy = (ctx: ExploreContext): PostWhere =>
  ctx.profileType === "band"
    ? { OR: [{ ownerBandId: null }, { ownerBandId: { not: ctx.profileId } }] }
    : ctx.profileType === "venue"
      ? { OR: [{ ownerVenueId: null }, { ownerVenueId: { not: ctx.profileId } }] }
      : { OR: [{ ownerUserId: null }, { ownerUserId: { not: ctx.profileId } }] };

const fetchPool = (ctx: ExploreContext, asOf: Date, where: PostWhere) =>
  prisma.post.findMany({
    where: {
      AND: [where, { deletedAt: null, createdAt: { lte: asOf } }, notOwnedBy(ctx)],
    },
    select: postSelect(asOf),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: POOL_SIZE,
  });

type PostRow = Awaited<ReturnType<typeof fetchPool>>[number];

export type RankedPost = PostCandidate & { row: PostRow };

const noRows = async (): Promise<PostRow[]> => [];

/** Who the acting profile follows, sampled like every other follow read here. */
const followees = async (ctx: ExploreContext) => {
  const followerKey =
    ctx.profileType === "band"
      ? { followerBandId: ctx.profileId }
      : ctx.profileType === "venue"
        ? { followerVenueId: ctx.profileId }
        : { followerUserId: ctx.profileId };

  const rows = await prisma.follow.findMany({
    where: followerKey,
    select: { followeeUserId: true, followeeBandId: true, followeeVenueId: true },
    take: FOLLOW_SAMPLE,
  });

  const ids = (pick: (r: (typeof rows)[number]) => string | null) =>
    new Set(rows.flatMap(r => {
      const id = pick(r);
      return id ? [id] : [];
    }));

  return {
    users: ids(r => r.followeeUserId),
    bands: ids(r => r.followeeBandId),
    venues: ids(r => r.followeeVenueId),
  };
};

/** The ranked posts for this context, capped at MAX_RANKED. */
export const rankExplorePosts = async (ctx: ExploreContext, asOf: Date): Promise<RankedPost[]> => {
  const follows = await followees(ctx);
  const genreIds = ctx.topGenres.map(g => g.id);

  const followedOwners: PostWhere[] = [];
  if (follows.users.size) followedOwners.push({ ownerUserId: { in: [...follows.users] } });
  if (follows.bands.size) followedOwners.push({ ownerBandId: { in: [...follows.bands] } });
  if (follows.venues.size) followedOwners.push({ ownerVenueId: { in: [...follows.venues] } });

  const pools = await Promise.all([
    ctx.sceneIds.length ? fetchPool(ctx, asOf, { sceneId: { in: ctx.sceneIds } }) : noRows(),
    followedOwners.length ? fetchPool(ctx, asOf, { OR: followedOwners }) : noRows(),
    ctx.followedSceneIds.length
      ? fetchPool(ctx, asOf, { sceneId: { in: ctx.followedSceneIds } })
      : noRows(),
    genreIds.length
      ? fetchPool(ctx, asOf, {
          ownerBand: { is: { genres: { some: { genreId: { in: genreIds } } } } },
        })
      : noRows(),
    fetchPool(ctx, asOf, {}),
  ]);

  const local = new Set(ctx.sceneIds);
  const followedScenes = new Set(ctx.followedSceneIds);
  const genres = new Set(genreIds);

  const candidates: RankedPost[] = pools
    .flat()
    // A deleted profile's posts go with it.
    .filter(row => !(row.ownerUser?.deletedAt || row.ownerBand?.deletedAt || row.ownerVenue?.deletedAt))
    .map(row => ({
      id: row.id,
      ownerKey: row.ownerBandId
        ? `BAND:${row.ownerBandId}`
        : row.ownerVenueId
          ? `VENUE:${row.ownerVenueId}`
          : `USER:${row.ownerUserId}`,
      createdAt: row.createdAt,
      likes: row._count.likes,
      comments: row._count.comments,
      signals: {
        local: !!row.sceneId && local.has(row.sceneId),
        followedOwner:
          (!!row.ownerUserId && follows.users.has(row.ownerUserId)) ||
          (!!row.ownerBandId && follows.bands.has(row.ownerBandId)) ||
          (!!row.ownerVenueId && follows.venues.has(row.ownerVenueId)),
        followedScene: !!row.sceneId && followedScenes.has(row.sceneId),
        genreMatch: !!row.ownerBand?.genres.some(g => genres.has(g.genreId)),
      },
      row,
    }));

  return rankPosts(candidates, asOf);
};

/**
 * A ranked post as an Explore item: the { id, name, subtitle, profileImageUrl,
 * accountType, type } binding contract, plus the media fields the grid needs.
 * Fields are picked one by one; nothing about the row leaks by default.
 */
export const toPostItem = ({ row }: RankedPost) => {
  const owner = row.ownerBand ?? row.ownerVenue ?? row.ownerUser;
  return {
    id: row.id,
    type: "POST" as const,
    accountType: (owner?.accountType as string | undefined) ?? null,
    name: owner?.name ?? "",
    subtitle: row.caption ?? "",
    profileImageUrl: owner?.profileImageUrl ?? null,
    url: row.url,
    mediaType: row.type,
    showId: row.showId,
  };
};
