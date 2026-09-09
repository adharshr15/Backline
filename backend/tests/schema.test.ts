import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  resetDatabase,
  registerUser,
  createBand,
  createVenue,
  createScene,
  createGenre,
  attachGenres,
  futureDate,
  TestUser,
} from "./helpers";

/**
 * Round-trip coverage for the Scene / Genre / BandGenre / UserCraft models added
 * for the Explore feature. These are schema-level guarantees the later endpoint
 * work leans on -- notably that resetDatabase() actually clears the new tables,
 * which is what keeps suites from leaking rows into each other.
 */
describe("explore schema", () => {
  let alice: TestUser;

  beforeAll(async () => {
    await resetDatabase();
    alice = await registerUser({ username: "alice_schema", name: "Alice" });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("Scene", () => {
    it("round-trips and enforces a unique slug", async () => {
      const id = await createScene({ city: "Houston", state: "TX", slug: "houston-tx" });

      const scene = await prisma.scene.findUnique({ where: { id } });
      expect(scene).toMatchObject({
        slug: "houston-tx",
        city: "Houston",
        state: "TX",
        country: "USA",
        isCurated: false,
        parentId: null,
      });

      await expect(
        createScene({ city: "Houston", state: "TX", slug: "houston-tx" }),
      ).rejects.toThrow();
    });

    it("supports the reserved parent/child self-relation", async () => {
      const parentId = await createScene({ city: "Dallas", state: "TX", slug: "dallas-tx" });
      const childId = await createScene({ city: "Deep Ellum", state: "TX", slug: "deep-ellum-tx" });

      await prisma.scene.update({ where: { id: childId }, data: { parentId } });

      const parent = await prisma.scene.findUnique({
        where: { id: parentId },
        include: { children: { select: { slug: true } } },
      });
      expect(parent?.children).toEqual([{ slug: "deep-ellum-tx" }]);
    });

    it("refuses to delete a scene that still has children", async () => {
      // onDelete: Restrict. This is why resetDatabase() detaches parents first.
      await expect(
        prisma.scene.delete({ where: { slug: "dallas-tx" } }),
      ).rejects.toThrow();
    });
  });

  describe("sceneId on Show, Band, Venue and User", () => {
    it("is nullable and settable on every profile and show", async () => {
      const sceneId = await createScene({ city: "Denton", state: "TX", slug: "denton-tx" });
      const bandId = await createBand(alice, "Schema Band");
      const venueId = await createVenue(alice, "Schema Venue");

      const show = await prisma.show.create({
        data: {
          date: new Date(futureDate()),
          doors: new Date(futureDate()),
          city: "Denton",
          state: "TX",
          country: "USA",
          venueId,
        },
      });

      // Nullable: nothing stamps sceneId yet (that lands with the write-path change).
      expect(show.sceneId).toBeNull();

      await prisma.band.update({ where: { id: bandId }, data: { sceneId } });
      await prisma.venue.update({ where: { id: venueId }, data: { sceneId } });
      await prisma.user.update({ where: { id: alice.id }, data: { sceneId } });
      await prisma.show.update({ where: { id: show.id }, data: { sceneId } });

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          _count: { select: { bands: true, venues: true, users: true, shows: true } },
        },
      });
      expect(scene?._count).toEqual({ bands: 1, venues: 1, users: 1, shows: 1 });
    });
  });

  describe("Genre and BandGenre", () => {
    it("nests children under a parent and stores aliases", async () => {
      await createGenre("rock", "Rock");
      const shoegazeId = await createGenre("shoegaze", "Shoegaze", "rock");

      await prisma.genre.update({
        where: { id: shoegazeId },
        data: { aliases: ["shoe gaze", "nugaze"] },
      });

      const rock = await prisma.genre.findUnique({
        where: { slug: "rock" },
        include: { children: { select: { slug: true, aliases: true } } },
      });
      expect(rock?.children).toEqual([
        { slug: "shoegaze", aliases: ["shoe gaze", "nugaze"] },
      ]);
    });

    it("finds genres by alias", async () => {
      const matches = await prisma.genre.findMany({ where: { aliases: { has: "nugaze" } } });
      expect(matches.map(g => g.slug)).toEqual(["shoegaze"]);
    });

    it("tags a band with ordered genres and refuses duplicates", async () => {
      const bandId = await createBand(alice, "Genre Band");
      await attachGenres(bandId, ["shoegaze", "rock"]);

      const tags = await prisma.bandGenre.findMany({
        where: { bandId },
        orderBy: { position: "asc" },
        include: { genre: { select: { slug: true } } },
      });
      expect(tags.map(t => [t.genre.slug, t.position])).toEqual([
        ["shoegaze", 0],
        ["rock", 1],
      ]);

      const { id: genreId } = (await prisma.genre.findUniqueOrThrow({ where: { slug: "rock" } }));
      await expect(
        prisma.bandGenre.create({ data: { bandId, genreId } }),
      ).rejects.toThrow();
    });

    it("selects bands by genre through the join", async () => {
      const bands = await prisma.band.findMany({
        where: { genres: { some: { genre: { slug: "shoegaze" } } } },
        select: { name: true },
      });
      expect(bands.map(b => b.name)).toEqual(["Genre Band"]);
    });
  });

  describe("UserCraft", () => {
    it("round-trips and is unique per (user, craft)", async () => {
      await prisma.userCraft.create({
        data: {
          userId: alice.id,
          craft: "PHOTOGRAPHER",
          forHire: true,
          headline: "Live show photography",
        },
      });

      const crafts = await prisma.userCraft.findMany({ where: { userId: alice.id } });
      expect(crafts).toHaveLength(1);
      expect(crafts[0]).toMatchObject({
        craft: "PHOTOGRAPHER",
        forHire: true,
        headline: "Live show photography",
      });

      await expect(
        prisma.userCraft.create({ data: { userId: alice.id, craft: "PHOTOGRAPHER" } }),
      ).rejects.toThrow();
    });

    it("filters for-hire practitioners by craft", async () => {
      const bob = await registerUser({ username: "bob_schema", name: "Bob" });
      await prisma.userCraft.create({
        data: { userId: bob.id, craft: "PHOTOGRAPHER", forHire: false },
      });

      const forHire = await prisma.userCraft.findMany({
        where: { craft: "PHOTOGRAPHER", forHire: true },
        select: { userId: true },
      });
      expect(forHire.map(c => c.userId)).toEqual([alice.id]);
    });
  });

  describe("SceneFollow.sceneId", () => {
    it("resolves its scene through the relation", async () => {
      const sceneId = await createScene({ city: "Waco", state: "TX", slug: "waco-tx" });

      const follow = await prisma.sceneFollow.create({
        data: {
          followerId: alice.id,
          followerType: "user",
          sceneId,
          city: "Waco",
          state: "TX",
          country: "USA",
        },
        include: { scene: { select: { slug: true } } },
      });

      expect(follow.scene.slug).toBe("waco-tx");
    });

    it("requires a scene", async () => {
      // Was nullable while the backfill was pending; migration B made it required.
      const sceneId = await createScene({ city: "Tulsa", state: "OK", slug: "tulsa-ok" });
      const follow = await prisma.sceneFollow.create({
        data: { followerId: alice.id, followerType: "user", sceneId },
      });
      expect(follow.sceneId).toBe(sceneId);
      expect(follow.city).toBeNull();
    });

    it("allows one follow per (follower, scene)", async () => {
      const sceneId = await createScene({ city: "Tyler", state: "TX", slug: "tyler-tx" });
      await prisma.sceneFollow.create({
        data: { followerId: alice.id, followerType: "user", sceneId },
      });

      await expect(
        prisma.sceneFollow.create({
          data: { followerId: alice.id, followerType: "user", sceneId },
        }),
      ).rejects.toThrow();
    });
  });

  describe("resetDatabase", () => {
    it("clears the new tables so suites do not leak rows", async () => {
      await resetDatabase();

      expect(await prisma.scene.count()).toBe(0);
      expect(await prisma.genre.count()).toBe(0);
      expect(await prisma.bandGenre.count()).toBe(0);
      expect(await prisma.userCraft.count()).toBe(0);

      // Re-register so afterAll's reset has a consistent starting point.
      alice = await registerUser({ username: "alice_schema2", name: "Alice" });
    });
  });
});
