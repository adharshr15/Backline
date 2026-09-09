import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  resetDatabase,
  registerUser,
  auth,
  createBand,
  createVenue,
  createScene,
  futureDate,
  TestUser,
} from "./helpers";

/**
 * GET /shows/feed.
 *
 * The feed is built from who a profile follows, so reading it discloses that
 * profile's follow graph. It was unauthenticated and took followerId straight
 * from the query string.
 */
describe("GET /shows/feed", () => {
  let alice: TestUser;
  let mallory: TestUser;
  let aliceBandId: string;

  let followedBandId: string;
  let followedVenueId: string;

  let bandShowId: string;
  let venueShowId: string;
  let sceneShowId: string;
  let unrelatedShowId: string;

  let dallasSceneId: string;

  const feed = (user: TestUser, qs: string) =>
    request(app).get(`/shows/feed?${qs}`).set(auth(user.token));

  beforeAll(async () => {
    await resetDatabase();

    alice = await registerUser({ username: "alice_feed", city: "Houston", state: "TX" });
    mallory = await registerUser({ username: "mallory_feed", city: "Houston", state: "TX" });
    aliceBandId = await createBand(alice, "Alice Feed Band");

    followedBandId = await createBand(alice, "Followed Band");
    followedVenueId = await createVenue(alice, "Followed Venue");

    dallasSceneId = await createScene({ city: "Dallas", state: "TX", slug: "dallas-tx" });

    // A show whose lineup includes the followed band.
    const bandShow = await prisma.show.create({
      data: {
        date: new Date(futureDate(5)),
        doors: new Date(futureDate(5)),
        city: "Austin", state: "TX", country: "USA",
      },
    });
    bandShowId = bandShow.id;
    await prisma.showBand.create({ data: { showId: bandShowId, bandId: followedBandId } });

    // A show at the followed venue.
    const venueShow = await prisma.show.create({
      data: {
        date: new Date(futureDate(6)),
        doors: new Date(futureDate(6)),
        city: "Austin", state: "TX", country: "USA",
        venueId: followedVenueId,
      },
    });
    venueShowId = venueShow.id;

    // A show in a followed scene, with nobody followed on it.
    const sceneShow = await prisma.show.create({
      data: {
        date: new Date(futureDate(7)),
        doors: new Date(futureDate(7)),
        city: "Dallas", state: "TX", country: "USA",
        sceneId: dallasSceneId,
      },
    });
    sceneShowId = sceneShow.id;

    // Connected to nothing Alice follows.
    const unrelated = await prisma.show.create({
      data: {
        date: new Date(futureDate(8)),
        doors: new Date(futureDate(8)),
        city: "Miami", state: "FL", country: "USA",
      },
    });
    unrelatedShowId = unrelated.id;

    // A past show on a followed band: must not appear.
    const past = await prisma.show.create({
      data: {
        date: new Date(Date.now() - 30 * 86_400_000),
        doors: new Date(Date.now() - 30 * 86_400_000),
        city: "Austin", state: "TX", country: "USA",
      },
    });
    await prisma.showBand.create({ data: { showId: past.id, bandId: followedBandId } });

    await request(app).post("/follows").set(auth(alice.token)).send({
      followerType: "USER", followeeType: "BAND", followeeId: followedBandId,
    });
    await request(app).post("/follows").set(auth(alice.token)).send({
      followerType: "USER", followeeType: "VENUE", followeeId: followedVenueId,
    });
    await request(app).post("/scenes/follow").set(auth(alice.token)).send({
      sceneId: dallasSceneId, followerId: alice.id, followerType: "user",
    });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("authorization", () => {
    it("401s without a token", async () => {
      const res = await request(app).get(
        `/shows/feed?followerType=user&followerId=${alice.id}`,
      );
      expect(res.status).toBe(401);
    });

    it("refuses to read another user's feed", async () => {
      const res = await feed(mallory, `followerType=user&followerId=${alice.id}`);
      expect(res.status).toBe(403);
    });

    it("refuses to read a band's feed when not a member", async () => {
      const res = await feed(mallory, `followerType=band&followerId=${aliceBandId}`);
      expect(res.status).toBe(403);
    });

    it("allows a band member to read the band's feed", async () => {
      const res = await feed(alice, `followerType=band&followerId=${aliceBandId}`);
      expect(res.status).toBe(200);
    });

    it("400s on a missing or invalid followerType", async () => {
      expect((await feed(alice, `followerId=${alice.id}`)).status).toBe(400);
      expect(
        (await feed(alice, `followerType=wizard&followerId=${alice.id}`)).status,
      ).toBe(400);
    });
  });

  describe("contents", () => {
    it("includes shows from followed bands, venues and scenes", async () => {
      const res = await feed(alice, `followerType=user&followerId=${alice.id}`);
      expect(res.status).toBe(200);

      const ids = res.body.map((s: any) => s.id);
      expect(ids).toContain(bandShowId);
      expect(ids).toContain(venueShowId);
      expect(ids).toContain(sceneShowId);
    });

    it("excludes unrelated and past shows", async () => {
      const res = await feed(alice, `followerType=user&followerId=${alice.id}`);

      const ids = res.body.map((s: any) => s.id);
      expect(ids).not.toContain(unrelatedShowId);
      for (const show of res.body) {
        expect(new Date(show.date).getTime()).toBeGreaterThan(Date.now());
      }
    });

    it("matches a scene by sceneId rather than by city string", async () => {
      // The old query compared city/state with an insensitive equality, which
      // compiles to ILIKE and cannot use an index. A show in the followed scene
      // whose city text differs must still appear.
      const oddCasing = await prisma.show.create({
        data: {
          date: new Date(futureDate(9)),
          doors: new Date(futureDate(9)),
          city: "DALLAS", state: "Texas", country: "USA",
          sceneId: dallasSceneId,
        },
      });

      const res = await feed(alice, `followerType=user&followerId=${alice.id}`);
      expect(res.body.map((s: any) => s.id)).toContain(oddCasing.id);
    });

    it("returns an empty array when the profile follows nothing", async () => {
      const res = await feed(mallory, `followerType=user&followerId=${mallory.id}`);
      expect(res.body).toEqual([]);
    });

    it("orders by date ascending", async () => {
      const res = await feed(alice, `followerType=user&followerId=${alice.id}`);
      const dates = res.body.map((s: any) => new Date(s.date).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => a - b));
    });
  });

  describe("bounds", () => {
    it("clamps an oversized limit", async () => {
      const res = await feed(alice, `followerType=user&followerId=${alice.id}&limit=99999`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(100);
    });

    it("paginates", async () => {
      const first = await feed(alice, `followerType=user&followerId=${alice.id}&limit=1&page=1`);
      const second = await feed(alice, `followerType=user&followerId=${alice.id}&limit=1&page=2`);

      expect(first.body).toHaveLength(1);
      expect(second.body).toHaveLength(1);
      expect(second.body[0].id).not.toBe(first.body[0].id);
    });
  });
});
