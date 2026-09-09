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
  seedGenres,
  attachGenres,
  setCrafts,
  futureDate,
  TestUser,
} from "./helpers";

describe("GET /search", () => {
  let alice: TestUser;
  let houstonId: string;

  let narrowHeadId: string;

  const get = (qs: string) => request(app).get(`/search?${qs}`).set(auth(alice.token));

  beforeAll(async () => {
    await resetDatabase();
    await seedGenres();

    alice = await registerUser({
      username: "narrowfan",
      name: "Narrow Fan",
      city: "Houston",
      state: "TX",
    });

    houstonId = (await prisma.scene.findUniqueOrThrow({ where: { slug: "houston-tx" } })).id;
    await createScene({ city: "Dallas", state: "TX", slug: "dallas-tx" });

    // Bands: an exact match, a prefix match and a substring match on "narrow".
    narrowHeadId = await createBand(alice, "Narrow");
    const prefixBand = await createBand(alice, "Narrowhead Rising");
    const substringBand = await createBand(alice, "The Narrowest Path");

    await prisma.band.updateMany({
      where: { id: { in: [narrowHeadId, prefixBand, substringBand] } },
      data: { sceneId: houstonId, city: "Houston", state: "TX" },
    });
    await attachGenres(narrowHeadId, ["shoegaze"]);
    await attachGenres(prefixBand, ["hardcore"]);

    const venueId = await createVenue(alice, "Narrow Room");
    await prisma.venue.update({
      where: { id: venueId },
      data: { sceneId: houstonId, city: "Houston", state: "TX" },
    });

    await prisma.show.create({
      data: {
        date: new Date(futureDate(5)),
        doors: new Date(futureDate(5)),
        city: "Houston",
        state: "TX",
        country: "USA",
        sceneId: houstonId,
        venueName: "Narrow Room",
      },
    });

    await setCrafts(alice, [{ craft: "PHOTOGRAPHER", forHire: true }]);

    // Soft-deleted: must never surface.
    const ghost = await createBand(alice, "Narrow Ghost");
    await prisma.band.update({ where: { id: ghost }, data: { deletedAt: new Date() } });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("auth and envelope", () => {
    it("401s without a token", async () => {
      expect((await request(app).get("/search?q=narrow")).status).toBe(401);
    });

    it("returns an envelope, not a bare array", async () => {
      const res = await get("q=narrow");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body).toHaveProperty("results");
      expect(res.body).toHaveProperty("counts");
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("limit");
      expect(res.body).toHaveProperty("hasMore");
    });

    it("returns an empty envelope for a blank query", async () => {
      const res = await get("q=");
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it("sets a short private cache header", async () => {
      const res = await get("q=narrow");
      expect(res.headers["cache-control"]).toBe("private, max-age=15");
    });
  });

  describe("result shape", () => {
    it("carries the fields the frontend binds to", async () => {
      const res = await get("q=narrow&type=band");
      const first = res.body.results[0];

      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("subtitle");
      expect(first).toHaveProperty("profileImageUrl");
      expect(first).toHaveProperty("accountType");
      expect(first).toHaveProperty("type");
    });

    it("labels a band with its resolved genre and place", async () => {
      const res = await get("q=Narrow&type=band");
      const band = res.body.results.find((r: any) => r.id === narrowHeadId);
      expect(band.subtitle).toBe("Shoegaze · Houston, TX");
      expect(band.genres.map((g: any) => g.slug)).toEqual(["shoegaze"]);
    });

    it("labels a user by craft when they have one", async () => {
      const res = await get("q=Narrow Fan&type=user");
      const user = res.body.results.find((r: any) => r.id === alice.id);
      expect(user.subtitle).toBe("Photographer · For hire");
    });

    it("gives scenes a slug", async () => {
      const res = await get("q=Houston&type=scene");
      expect(res.body.results[0]).toMatchObject({ type: "SCENE", slug: "houston-tx" });
    });
  });

  describe("type filter", () => {
    it("searches every type by default", async () => {
      const res = await get("q=narrow");
      const types = new Set(res.body.results.map((r: any) => r.type));
      expect(types.has("BAND")).toBe(true);
      expect(types.has("VENUE")).toBe(true);
    });

    it("restricts to the requested types", async () => {
      const res = await get("q=narrow&type=venue");
      expect(res.body.results.every((r: any) => r.type === "VENUE")).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    it("accepts a csv of types", async () => {
      const res = await get("q=narrow&type=band,venue");
      const types = new Set(res.body.results.map((r: any) => r.type));
      expect([...types].sort()).toEqual(["BAND", "VENUE"]);
    });

    it("400s on an unknown type", async () => {
      expect((await get("q=narrow&type=bogus")).status).toBe(400);
    });
  });

  describe("ranking", () => {
    it("puts an exact match above a prefix match above a substring match", async () => {
      const res = await get("q=Narrow&type=band");
      const names = res.body.results.map((r: any) => r.name);

      expect(names[0]).toBe("Narrow");
      expect(names.indexOf("Narrowhead Rising")).toBeLessThan(
        names.indexOf("The Narrowest Path"),
      );
    });

    it("promotes results in the searched city", async () => {
      const far = await createBand(alice, "Narrow");
      await prisma.band.update({
        where: { id: far },
        data: { city: "Dallas", state: "TX", sceneId: null },
      });

      const res = await get("q=Narrow&type=band&city=Houston&state=TX");
      expect(res.body.results[0].id).toBe(narrowHeadId);

      // Soft-delete: the band still has a BandMember, so it cannot be removed
      // outright, and soft deletion is what the app does anyway.
      await prisma.band.update({ where: { id: far }, data: { deletedAt: new Date() } });
    });
  });

  describe("filters", () => {
    it("filters by genre slug, display name and alias alike", async () => {
      const bySlug = await get("q=narrow&type=band&genre=shoegaze");
      const byName = await get("q=narrow&type=band&genre=Shoegaze");
      const byAlias = await get("q=narrow&type=band&genre=nugaze");

      const ids = (r: any) => r.body.results.map((x: any) => x.id);
      expect(ids(bySlug)).toEqual([narrowHeadId]);
      expect(ids(byName)).toEqual(ids(bySlug));
      expect(ids(byAlias)).toEqual(ids(bySlug));
    });

    it("returns nothing for an unknown genre rather than 400", async () => {
      const res = await get("q=narrow&genre=not-a-genre");
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it("filters by city and state", async () => {
      const hit = await get("q=narrow&city=Houston&state=TX");
      expect(hit.body.results.length).toBeGreaterThan(0);

      const miss = await get("q=narrow&city=Nowhere&state=ZZ");
      expect(miss.body.results).toEqual([]);
    });

    it("accepts a spelled-out state", async () => {
      const byCode = await get("q=narrow&type=band&state=TX");
      const byName = await get("q=narrow&type=band&state=Texas");
      expect(byName.body.results.length).toBe(byCode.body.results.length);
    });

    it("filters by craft", async () => {
      const hit = await get("q=Narrow Fan&craft=PHOTOGRAPHER");
      expect(hit.body.results.map((r: any) => r.id)).toEqual([alice.id]);

      const miss = await get("q=Narrow Fan&craft=BOOKER");
      expect(miss.body.results).toEqual([]);
    });

    it("400s on an unknown craft", async () => {
      expect((await get("q=narrow&craft=WIZARD")).status).toBe(400);
    });

    it("scopes to a scene", async () => {
      const hit = await get("q=narrow&type=band&sceneSlug=houston-tx");
      expect(hit.body.results.length).toBeGreaterThan(0);

      const other = await get("q=narrow&type=band&sceneSlug=dallas-tx");
      expect(other.body.results).toEqual([]);
    });

    it("returns nothing for an unknown scene rather than 404", async () => {
      const res = await get("q=narrow&sceneSlug=nowhere-zz");
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it("finds a show by its venue name", async () => {
      const res = await get("q=Narrow Room&type=show");
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].type).toBe("SHOW");
    });
  });

  describe("pagination", () => {
    it("clamps an oversized limit", async () => {
      const res = await get("q=narrow&limit=1000");
      expect(res.body.limit).toBe(50);
    });

    it("reports hasMore and advances through pages", async () => {
      const first = await get("q=narrow&type=band&limit=1&page=1");
      expect(first.body.results).toHaveLength(1);
      expect(first.body.hasMore).toBe(true);

      const second = await get("q=narrow&type=band&limit=1&page=2");
      expect(second.body.results[0].id).not.toBe(first.body.results[0].id);
    });

    it("400s past the maximum page depth", async () => {
      const res = await get("q=narrow&page=9");
      expect(res.status).toBe(400);
    });
  });

  describe("disclosure", () => {
    it("excludes soft-deleted rows", async () => {
      const res = await get("q=Narrow Ghost");
      expect(res.body.results).toEqual([]);
    });

    it("never returns a password or email", async () => {
      const res = await get("q=Narrow");
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("password");
      expect(body).not.toContain("@test.com");

      for (const result of res.body.results) {
        expect(result).not.toHaveProperty("password");
        expect(result).not.toHaveProperty("email");
      }
    });
  });
});
