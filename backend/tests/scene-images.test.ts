import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  resetDatabase,
  registerUser,
  auth,
  createBand,
  createScene,
  seedGenres,
  attachGenres,
  TestUser,
} from "./helpers";

/**
 * A scene's avatar is the banner of its most-followed band that has one, and its
 * banner is the second. Genre facets apply the same rule to their own bands.
 * Each slot falls back to the scene's own image, then null.
 */
describe("scene images", () => {
  let alice: TestUser;
  let houstonId: string;
  let dallasId: string;

  // One shared pool: registering a fresh fan per follow would trip the auth
  // rate limiter (20 per IP). One user following several bands is fine.
  let fans: TestUser[] = [];

  const followers = async (bandId: string, n: number) => {
    await prisma.follow.createMany({
      data: fans.slice(0, n).map(f => ({
        followerUserId: f.id,
        followerType: "USER" as const,
        followeeBandId: bandId,
        followeeType: "BAND" as const,
      })),
    });
  };

  const band = async (
    name: string,
    opts: { sceneId: string; banner?: string; genres?: string[]; fans?: number; deleted?: boolean },
  ) => {
    const id = await createBand(alice, name);
    await prisma.band.update({
      where: { id },
      data: {
        sceneId: opts.sceneId,
        headerImageUrl: opts.banner ?? null,
        deletedAt: opts.deleted ? new Date() : null,
      },
    });
    if (opts.genres) await attachGenres(id, opts.genres);
    if (opts.fans) await followers(id, opts.fans);
    return id;
  };

  beforeAll(async () => {
    await resetDatabase();
    await seedGenres();

    alice = await registerUser({ username: "alice_images", city: "Houston", state: "TX" });
    fans = await Promise.all(Array.from({ length: 10 }, () => registerUser()));
    houstonId = (await prisma.scene.findUniqueOrThrow({ where: { slug: "houston-tx" } })).id;
    dallasId = await createScene({ city: "Dallas", state: "TX", slug: "dallas-tx" });
    await prisma.scene.update({
      where: { id: dallasId },
      data: { imageUrl: "/uploads/dallas-own-avatar.jpg", headerImageUrl: "/uploads/dallas-own-banner.jpg" },
    });
    await createScene({ city: "Waco", state: "TX", slug: "waco-tx" });

    // Houston, by followers: Bannerless Star 5 (skipped: no banner), Big Gaze 3,
    // Mid Punk 2, Small Gaze 1. The deleted band would otherwise win outright.
    await band("Bannerless Star", { sceneId: houstonId, genres: ["shoegaze"], fans: 5 });
    await band("Big Gaze", { sceneId: houstonId, banner: "/uploads/big-gaze.jpg", genres: ["shoegaze"], fans: 3 });
    await band("Mid Punk", { sceneId: houstonId, banner: "/uploads/mid-punk.jpg", genres: ["punk"], fans: 2 });
    await band("Small Gaze", { sceneId: houstonId, banner: "/uploads/small-gaze.jpg", genres: ["shoegaze"], fans: 1 });
    await band("Gone Band", { sceneId: houstonId, banner: "/uploads/gone.jpg", genres: ["shoegaze"], fans: 9, deleted: true });

    // Dallas: one bannered band, and it outdraws everything in Houston.
    await band("Dallas Draw", { sceneId: dallasId, banner: "/uploads/dallas-draw.jpg", fans: 10 });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("GET /scenes/:slug", () => {
    it("uses the top two bannered bands by followers", async () => {
      const res = await request(app).get("/scenes/houston-tx");
      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBe("/uploads/big-gaze.jpg");
      expect(res.body.headerImageUrl).toBe("/uploads/mid-punk.jpg");
    });

    it("applies the same rule within each genre facet", async () => {
      const res = await request(app).get("/scenes/houston-tx");
      const facet = (slug: string) => res.body.topGenres.find((g: any) => g.slug === slug);

      expect(facet("shoegaze")).toMatchObject({
        imageUrl: "/uploads/big-gaze.jpg",
        headerImageUrl: "/uploads/small-gaze.jpg",
      });
      // Only one bannered punk band, and Houston has no image of its own.
      expect(facet("punk")).toMatchObject({
        imageUrl: "/uploads/mid-punk.jpg",
        headerImageUrl: null,
      });
    });

    it("falls back slot by slot to the scene's own images", async () => {
      const res = await request(app).get("/scenes/dallas-tx");
      expect(res.body.imageUrl).toBe("/uploads/dallas-draw.jpg");
      expect(res.body.headerImageUrl).toBe("/uploads/dallas-own-banner.jpg");
    });

    it("is null throughout for a scene with no bannered bands or images", async () => {
      const res = await request(app).get("/scenes/waco-tx");
      expect(res.body.imageUrl).toBeNull();
      expect(res.body.headerImageUrl).toBeNull();
    });

    it("matches through /scenes/by-location", async () => {
      const res = await request(app).get("/scenes/by-location?city=Houston&state=TX");
      expect(res.body.imageUrl).toBe("/uploads/big-gaze.jpg");
      expect(res.body.headerImageUrl).toBe("/uploads/mid-punk.jpg");
    });
  });

  describe("everywhere else a scene avatar appears", () => {
    it("GET /scenes", async () => {
      const res = await request(app).get("/scenes?sort=name");
      const bySlug = new Map(res.body.scenes.map((s: any) => [s.slug, s.imageUrl]));
      expect(bySlug.get("houston-tx")).toBe("/uploads/big-gaze.jpg");
      expect(bySlug.get("dallas-tx")).toBe("/uploads/dallas-draw.jpg");
    });

    it("GET /scenes/following", async () => {
      await request(app).post("/scenes/follow").set(auth(alice.token))
        .send({ slug: "houston-tx", followerId: alice.id, followerType: "user" });

      const res = await request(app)
        .get(`/scenes/following?followerId=${alice.id}&followerType=user`)
        .set(auth(alice.token));
      const houston = res.body.find((f: any) => f.scene.slug === "houston-tx");
      expect(houston.scene.imageUrl).toBe("/uploads/big-gaze.jpg");
    });

    it("Explore's Scenes to Follow", async () => {
      const res = await request(app).get("/explore").set(auth(alice.token));
      const scenes = res.body.sections.find((s: any) => s.key === "scenes_for_you");
      const dallas = scenes.items.find((i: any) => i.slug === "dallas-tx");
      expect(dallas.profileImageUrl).toBe("/uploads/dallas-draw.jpg");
    });
  });
});
