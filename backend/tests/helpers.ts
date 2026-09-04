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
  await prisma.band.deleteMany();
  await prisma.venueInvite.deleteMany();
  await prisma.venueRepresentative.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
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
