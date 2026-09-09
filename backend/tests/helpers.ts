import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

export interface TestUser {
  id: string;
  token: string;
  username: string;
  email: string;
  password: string;
}

/**
 * Truncate every table the API writes to, in FK-safe order.
 * Suites share one database and run serially (see vitest.config.ts).
 */
export const resetDatabase = async () => {
  await prisma.postLike.deleteMany();
  await prisma.postComment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.listingMedia.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationInvite.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.sceneFollow.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.showInvite.deleteMany();
  await prisma.showBand.deleteMany();
  await prisma.show.deleteMany();
  await prisma.tourInvite.deleteMany();
  await prisma.bandTour.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.bandInvite.deleteMany();
  await prisma.bandMember.deleteMany();
  await prisma.bandGenre.deleteMany();
  await prisma.band.deleteMany();
  await prisma.venueInvite.deleteMany();
  await prisma.venueRepresentative.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.userCraft.deleteMany();
  await prisma.user.deleteMany();
  // Genre and Scene are self-referencing with onDelete: Restrict, so a parent
  // cannot be deleted while a child points at it. Detach first, then delete.
  await prisma.genre.updateMany({ data: { parentId: null } });
  await prisma.genre.deleteMany();
  await prisma.scene.updateMany({ data: { parentId: null } });
  await prisma.scene.deleteMany();
};

let seq = 0;

/** Register a user through the real endpoint and return their id + token. */
export const registerUser = async (overrides: Partial<{
  name: string; username: string; email: string; password: string;
  city: string; state: string; country: string;
}> = {}): Promise<TestUser> => {
  seq += 1;
  const username = overrides.username ?? `user${seq}_${Date.now()}`;
  const email = overrides.email ?? `${username}@test.com`;
  const password = overrides.password ?? "password123";

  const res = await request(app).post("/auth/register").send({
    name: overrides.name ?? `User ${seq}`,
    username,
    email,
    password,
    city: overrides.city ?? "Austin",
    state: overrides.state ?? "TX",
    country: overrides.country ?? "USA",
  });

  if (res.status !== 201) {
    throw new Error(`registerUser failed (${res.status}): ${JSON.stringify(res.body)}`);
  }

  return { id: res.body.user.id, token: res.body.token, username, email, password };
};

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Create a band with `owner` as its MANAGER. */
export const createBand = async (owner: TestUser, name = `Band ${++seq}`) => {
  const res = await request(app)
    .post("/bands")
    .set(auth(owner.token))
    .send({ name, city: "Austin", state: "TX", country: "USA" });

  if (res.status !== 201) {
    throw new Error(`createBand failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
};

/** Create a venue with `owner` as its MANAGER representative. */
export const createVenue = async (owner: TestUser, name = `Venue ${++seq}`) => {
  const res = await request(app)
    .post("/venues")
    .set(auth(owner.token))
    .send({ name, city: "Austin", state: "TX", country: "USA" });

  if (res.status !== 201) {
    throw new Error(`createVenue failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
};

export const futureDate = (daysAhead = 30) =>
  new Date(Date.now() + daysAhead * 86_400_000).toISOString();

/**
 * Scene / genre fixtures.
 *
 * Heads up: registerUser, createBand and createVenue all default to Austin, TX.
 * Once the write paths stamp sceneId, every suite that registers anyone creates
 * an "Austin, TX" scene as a side effect. Assert on a specific slug, never on a
 * total scene count.
 */
export const createScene = async (overrides: Partial<{
  city: string; state: string; country: string; slug: string;
  name: string; isCurated: boolean; latitude: number; longitude: number;
}> = {}) => {
  const city = overrides.city ?? "Houston";
  const state = overrides.state ?? "TX";

  const scene = await prisma.scene.create({
    data: {
      slug: overrides.slug ?? `${city}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: overrides.name ?? city,
      city,
      state,
      country: overrides.country ?? "USA",
      isCurated: overrides.isCurated ?? false,
      latitude: overrides.latitude ?? null,
      longitude: overrides.longitude ?? null,
    },
  });
  return scene.id;
};

export const createGenre = async (slug: string, name?: string, parentSlug?: string) => {
  const parent = parentSlug
    ? await prisma.genre.findUnique({ where: { slug: parentSlug } })
    : null;

  const genre = await prisma.genre.create({
    data: {
      slug,
      name: name ?? slug,
      parentId: parent?.id ?? null,
    },
  });
  return genre.id;
};

/** Tag a band with genres by slug, in order (position 0 = primary). */
export const attachGenres = async (bandId: string, slugs: string[]) => {
  const genres = await prisma.genre.findMany({ where: { slug: { in: slugs } } });
  const bySlug = new Map(genres.map(g => [g.slug, g.id]));

  await prisma.bandGenre.createMany({
    data: slugs.flatMap((slug, position) => {
      const genreId = bySlug.get(slug);
      return genreId ? [{ bandId, genreId, position }] : [];
    }),
    skipDuplicates: true,
  });
};
