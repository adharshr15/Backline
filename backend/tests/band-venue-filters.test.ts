import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  resetDatabase,
  registerUser,
  createBand,
  createVenue,
  createScene,
  seedGenres,
  attachGenres,
  TestUser,
} from "./helpers";

/**
 * List-filter behaviour for GET /bands and GET /venues.
 *
 * Kept out of band.test.ts / venue.test.ts deliberately: those suites predate
 * tests/helpers.ts and hand-roll their own cleanup, which does not clear the
 * Scene, Genre or BandGenre tables. Adding genre fixtures there would leave rows
 * that make their own `band.deleteMany()` fail.
 */
describe("band and venue list filters", () => {
  let alice: TestUser;
  let houstonId: string;

  let punkRockBandId: string;
  let shoegazeBandId: string;
  let dallasBandId: string;

  let bigVenueId: string;
  let smallVenueId: string;

  beforeAll(async () => {
    await resetDatabase();
    await seedGenres();

    alice = await registerUser({ username: "alice_filters", city: "Houston", state: "TX" });
    houstonId = (await prisma.scene.findUniqueOrThrow({ where: { slug: "houston-tx" } })).id;
    const dallasId = await createScene({ city: "Dallas", state: "TX", slug: "dallas-tx" });

    // The legacy `contains` matcher treated "Punk Rock" as a match for ?genre=Rock.
    // With a real taxonomy that is now an explicit decision, not a substring accident.
    punkRockBandId = await createBand(alice, "Punk Rock Band");
    shoegazeBandId = await createBand(alice, "Shoegaze Band");
    await prisma.band.updateMany({
      where: { id: { in: [punkRockBandId, shoegazeBandId] } },
      data: { sceneId: houstonId, city: "Houston", state: "TX" },
    });
    await attachGenres(punkRockBandId, ["punk"]);
    await attachGenres(shoegazeBandId, ["shoegaze"]);

    dallasBandId = await createBand(alice, "Dallas Band");
    await prisma.band.update({
      where: { id: dallasBandId },
      data: { sceneId: dallasId, city: "Dallas", state: "TX" },
    });
    await attachGenres(dallasBandId, ["shoegaze"]);

    bigVenueId = await createVenue(alice, "Big Room");
    smallVenueId = await createVenue(alice, "Tiny Room");
    await prisma.venue.update({
      where: { id: bigVenueId },
      data: { sceneId: houstonId, city: "Houston", state: "TX", capacity: 1200 },
    });
    await prisma.venue.update({
      where: { id: smallVenueId },
      data: { sceneId: houstonId, city: "Houston", state: "TX", capacity: 150 },
    });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("GET /bands", () => {
    const names = (res: any) => res.body.map((b: any) => b.name).sort();

    it("still returns a bare array", async () => {
      const res = await request(app).get("/bands");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("clamps an oversized limit", async () => {
      const res = await request(app).get("/bands?limit=99999");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(100);
    });

    it("filters by genre slug", async () => {
      const res = await request(app).get("/bands?genre=shoegaze");
      expect(names(res)).toEqual(["Dallas Band", "Shoegaze Band"]);
    });

    it("accepts display names and aliases for a genre", async () => {
      const bySlug = await request(app).get("/bands?genre=shoegaze");
      const byName = await request(app).get("/bands?genre=Shoegaze");
      const byAlias = await request(app).get("/bands?genre=nugaze");

      expect(names(byName)).toEqual(names(bySlug));
      expect(names(byAlias)).toEqual(names(bySlug));
    });

    it("resolves the labels the shipped genre chips send", async () => {
      // "R&B" and "Hip-Hop" have to keep working for existing clients.
      for (const label of ["R&B", "Hip-Hop", "Indie", "Punk"]) {
        const res = await request(app).get(`/bands?genre=${encodeURIComponent(label)}`);
        expect(res.status).toBe(200);
      }

      const punk = await request(app).get("/bands?genre=Punk");
      expect(names(punk)).toEqual(["Punk Rock Band"]);
    });

    it("no longer matches a genre by substring", async () => {
      // The old `contains` filter returned "Punk Rock Band" for ?genre=Rock.
      const res = await request(app).get("/bands?genre=Rock");
      expect(names(res)).not.toContain("Punk Rock Band");
    });

    it("returns an empty array for an unknown genre rather than 400", async () => {
      const res = await request(app).get("/bands?genre=not-a-real-genre");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("accepts multiple genres", async () => {
      const res = await request(app).get("/bands?genre=shoegaze,punk");
      expect(names(res)).toEqual(["Dallas Band", "Punk Rock Band", "Shoegaze Band"]);
    });

    it("honours excludeId, which used to be ignored", async () => {
      const res = await request(app).get(`/bands?genre=shoegaze&excludeId=${dallasBandId}`);
      expect(names(res)).toEqual(["Shoegaze Band"]);
    });

    it("filters by sceneSlug", async () => {
      const res = await request(app).get("/bands?sceneSlug=houston-tx");
      expect(names(res)).toEqual(["Punk Rock Band", "Shoegaze Band"]);
    });

    it("returns an empty array for an unknown scene", async () => {
      const res = await request(app).get("/bands?sceneSlug=nowhere-zz");
      expect(res.body).toEqual([]);
    });

    it("filters by city and either spelling of the state", async () => {
      const byCode = await request(app).get("/bands?city=Houston&state=TX");
      const byName = await request(app).get("/bands?city=Houston&state=Texas");

      expect(names(byCode)).toEqual(["Punk Rock Band", "Shoegaze Band"]);
      expect(names(byName)).toEqual(names(byCode));
    });

    it("embeds resolved genres, and no legacy genre field", async () => {
      const res = await request(app).get("/bands?genre=shoegaze&sceneSlug=houston-tx");
      const band = res.body[0];

      expect(band.genres.map((g: any) => g.slug)).toEqual(["shoegaze"]);
      expect(band).not.toHaveProperty("genre");
    });
  });

  describe("GET /venues", () => {
    const names = (res: any) => res.body.map((v: any) => v.name).sort();

    it("still returns a bare array", async () => {
      const res = await request(app).get("/venues");
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("clamps an oversized limit", async () => {
      const res = await request(app).get("/venues?limit=99999");
      expect(res.body.length).toBeLessThanOrEqual(100);
    });

    it("filters by capacity range", async () => {
      expect(names(await request(app).get("/venues?minCapacity=500"))).toEqual(["Big Room"]);
      expect(names(await request(app).get("/venues?maxCapacity=500"))).toEqual(["Tiny Room"]);
      expect(names(await request(app).get("/venues?minCapacity=100&maxCapacity=2000"))).toEqual([
        "Big Room",
        "Tiny Room",
      ]);
    });

    it("filters by sceneSlug", async () => {
      const res = await request(app).get("/venues?sceneSlug=houston-tx");
      expect(names(res)).toEqual(["Big Room", "Tiny Room"]);

      const other = await request(app).get("/venues?sceneSlug=dallas-tx");
      expect(other.body).toEqual([]);
    });

    it("honours excludeId", async () => {
      const res = await request(app).get(`/venues?sceneSlug=houston-tx&excludeId=${bigVenueId}`);
      expect(names(res)).toEqual(["Tiny Room"]);
    });

    it("accepts either spelling of the state", async () => {
      const byCode = await request(app).get("/venues?city=Houston&state=TX");
      const byName = await request(app).get("/venues?city=Houston&state=Texas");
      expect(names(byName)).toEqual(names(byCode));
    });
  });
});
