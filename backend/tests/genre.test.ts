import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  resetDatabase,
  registerUser,
  createBand,
  createScene,
  seedGenres,
  attachGenres,
  TestUser,
} from "./helpers";
import { GENRE_SEED } from "../src/lib/genres.seed";

describe("GET /genres", () => {
  let alice: TestUser;
  let houstonId: string;

  beforeAll(async () => {
    await resetDatabase();
    await seedGenres();

    alice = await registerUser({ username: "alice_genre", name: "Alice" });
    houstonId = await createScene({ city: "Houston", state: "TX", slug: "houston-tx" });

    const shoegazeBand = await createBand(alice, "Gaze Band");
    await attachGenres(shoegazeBand, ["shoegaze"]);
    await prisma.band.update({ where: { id: shoegazeBand }, data: { sceneId: houstonId } });

    // A band in no scene at all -- its genre must not leak into ?sceneSlug=.
    const nomadBand = await createBand(alice, "Nomad Band");
    await attachGenres(nomadBand, ["tejano"]);
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("seeding", () => {
    it("seeds the whole taxonomy", async () => {
      expect(await prisma.genre.count()).toBe(GENRE_SEED.length);
    });

    it("is idempotent", async () => {
      await seedGenres();
      expect(await prisma.genre.count()).toBe(GENRE_SEED.length);
    });
  });

  describe("tree shape", () => {
    it("returns roots with their children nested", async () => {
      const res = await request(app).get("/genres");
      expect(res.status).toBe(200);

      const rock = res.body.genres.find((g: any) => g.slug === "rock");
      expect(rock).toBeDefined();
      expect(rock.parentSlug).toBeNull();
      expect(rock.children.map((c: any) => c.slug)).toContain("shoegaze");

      const shoegaze = rock.children.find((c: any) => c.slug === "shoegaze");
      expect(shoegaze).toMatchObject({ slug: "shoegaze", name: "Shoegaze", parentSlug: "rock" });
    });

    it("does not put a child at the top level", async () => {
      const res = await request(app).get("/genres");
      expect(res.body.genres.map((g: any) => g.slug)).not.toContain("shoegaze");
    });

    it("orders roots by sortOrder", async () => {
      const res = await request(app).get("/genres");
      const order = res.body.genres.map((g: any) => g.sortOrder);
      expect(order).toEqual([...order].sort((a: number, b: number) => a - b));
      expect(res.body.genres[0].slug).toBe("rock");
    });

    it("is public", async () => {
      // No Authorization header at all.
      const res = await request(app).get("/genres");
      expect(res.status).toBe(200);
    });
  });

  describe("?flat=1", () => {
    it("returns one flat list with parentSlug instead of nesting", async () => {
      const res = await request(app).get("/genres?flat=1");
      expect(res.status).toBe(200);
      expect(res.body.genres).toHaveLength(GENRE_SEED.length);

      const shoegaze = res.body.genres.find((g: any) => g.slug === "shoegaze");
      expect(shoegaze).toMatchObject({ parentSlug: "rock" });
      expect(shoegaze.children).toBeUndefined();
    });
  });

  describe("?sceneSlug=", () => {
    it("returns only genres bands in that scene actually carry", async () => {
      const res = await request(app).get("/genres?sceneSlug=houston-tx&flat=1");
      expect(res.status).toBe(200);
      expect(res.body.genres.map((g: any) => g.slug)).toEqual(["shoegaze"]);
    });

    it("promotes a child to the top level when its parent is filtered out", async () => {
      // Houston has a shoegaze band but no plain-rock band, so "rock" is absent.
      // Dropping shoegaze because its parent is missing would empty the response.
      const res = await request(app).get("/genres?sceneSlug=houston-tx");
      expect(res.body.genres.map((g: any) => g.slug)).toEqual(["shoegaze"]);
    });

    it("returns an empty list for an unknown scene rather than 404", async () => {
      const res = await request(app).get("/genres?sceneSlug=nowhere-zz");
      expect(res.status).toBe(200);
      expect(res.body.genres).toEqual([]);
    });

    it("returns an empty list for a scene with no tagged bands", async () => {
      await createScene({ city: "Waco", state: "TX", slug: "waco-tx" });
      const res = await request(app).get("/genres?sceneSlug=waco-tx");
      expect(res.status).toBe(200);
      expect(res.body.genres).toEqual([]);
    });
  });

  describe("isActive", () => {
    it("hides deactivated genres", async () => {
      await prisma.genre.update({ where: { slug: "k-pop" }, data: { isActive: false } });

      const res = await request(app).get("/genres?flat=1");
      expect(res.body.genres.map((g: any) => g.slug)).not.toContain("k-pop");

      await prisma.genre.update({ where: { slug: "k-pop" }, data: { isActive: true } });
    });
  });
});
