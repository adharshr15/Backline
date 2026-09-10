/**
 * Shared Prisma `select` shapes.
 *
 * Use these instead of `include` on User. `include` returns every scalar column —
 * including `password` — and relies on the caller remembering to `delete` the hash
 * before responding. A `select` cannot leak a field nobody listed.
 */

/** A user's own record: safe to return to that user. */
export const userPrivateSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  accountType: true,
  bio: true,
  city: true,
  state: true,
  country: true,
  profileImageUrl: true,
  headerImageUrl: true,
  createdAt: true,
} as const;

/** A user as seen by anyone else: no email address. */
export const userPublicSelect = {
  id: true,
  username: true,
  name: true,
  accountType: true,
  bio: true,
  city: true,
  state: true,
  country: true,
  profileImageUrl: true,
  headerImageUrl: true,
  createdAt: true,
} as const;

/**
 * A user's crafts (photographer, promoter, sound engineer, …), ordered.
 * Supersedes the dead `isPromoter` boolean, which no endpoint ever wrote.
 */
export const userCraftsSelect = {
  select: { craft: true, forHire: true, headline: true },
  orderBy: { position: "asc" },
} as const;

/** A band's genres, primary first. Pass the row through flattenGenres before responding. */
export const bandGenresSelect = {
  select: { genre: { select: { slug: true, name: true } } },
  orderBy: { position: "asc" },
} as const;

/** `genres: [{ genre: {slug, name} }]` -> `genres: [{slug, name}]`, the shape GET /bands returns. */
export const flattenGenres = <T extends { genres: { genre: { slug: string; name: string } }[] }>(
  band: T,
) => ({ ...band, genres: band.genres.map(g => g.genre) });

/** Minimal shape for avatars and name chips in lists. */
export const profileSummarySelect = {
  id: true,
  name: true,
  profileImageUrl: true,
  accountType: true,
} as const;
