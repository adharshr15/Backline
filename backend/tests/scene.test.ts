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
  futureDate,
  TestUser,
} from "./helpers";

/**
 * Scene discovery, detail and roster endpoints.
 *
 * Note: registerUser/createBand/createVenue default to Austin, TX, so an Austin
 * scene exists as a side effect of any fixture. Assertions here key off specific
 * slugs rather than total scene counts.
 */
describe("scene read endpoints", () => {
  let alice: TestUser;
  let houstonId: string;
  let dallasId: string;

  let gazeBandId: string;
  let hardcoreBandId: string;

  beforeAll(async () => {
    await resetDatabase();
    await seedGenres();

    alice = await registerUser({ username: "alice_scene", city: "Houston", state: "TX" });

    houstonId = (await prisma.scene.findUniqueOrThrow({ where: { slug: "houston-tx" } })).id;
    await prisma.scene.update({
      where: { id: houstonId },
      data: { latitude: 29.7604, longitude: -95.3698, isCurated: true, bio: "Bayou City" },
    });

    dallasId = await createScene({
      city: "Dallas",
      state: "TX",
      slug: "dallas-tx",
      latitude: 32.7767,
      longitude: -96.797,
    });

    // Houston: two bands with different genres, two venues, one user with a craft.
    gazeBandId = await createBand(alice, "Gaze Band");
    hardcoreBandId = await createBand(alice, "Rage Band");
    await prisma.band.updateMany({
      where: { id: { in: [gazeBandId, hardcoreBandId] } },
      data: { sceneId: houstonId, city: "Houston", state: "TX" },
    });
    await attachGenres(gazeBandId, ["shoegaze", "dream-pop"]);
    await attachGenres(hardcoreBandId, ["hardcore"]);

    const bigVenue = await createVenue(alice, "Big Room");
    const smallVenue = await createVenue(alice, "Tiny Room");
    await prisma.venue.update({
      where: { id: bigVenue },
      data: { sceneId: houstonId, city: "Houston", state: "TX", capacity: 1200 },
    });
    await prisma.venue.update({
      where: { id: smallVenue },
      data: { sceneId: houstonId, city: "Houston", state: "TX", capacity: 150 },
    });

    await prisma.userCraft.create({
      data: { userId: alice.id, craft: "PHOTOGRAPHER", forHire: true, headline: "Live shows" },
    });

    // A Dallas band that must never appear in Houston results.
    const dallasBand = await createBand(alice, "Dallas Band");
    await prisma.band.update({
      where: { id: dallasBand },
      data: { sceneId: dallasId, city: "Dallas", state: "TX" },
    });
    await attachGenres(dallasBand, ["shoegaze"]);

    // Shows: one upcoming in Houston with the shoegaze band, one past.
    const upcoming = await prisma.show.create({
      data: {
        date: new Date(futureDate(10)),
        doors: new Date(futureDate(10)),
        city: "Houston",
        state: "TX",
        country: "USA",
        sceneId: houstonId,
        venueName: "Big Room",
      },
    });
    await prisma.showBand.create({ data: { showId: upcoming.id, bandId: gazeBandId } });

    await prisma.show.create({
      data: {
        date: new Date(Date.now() - 30 * 86_400_000),
        doors: new Date(Date.now() - 30 * 86_400_000),
        city: "Houston",
        state: "TX",
        country: "USA",
        sceneId: houstonId,
      },
    });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("GET /scenes", () => {
    it("is public and returns scenes with counts", async () => {
      const res = await request(app).get("/scenes");
      expect(res.status).toBe(200);

      const houston = res.body.scenes.find((s: any) => s.slug === "houston-tx");
      expect(houston).toBeDefined();
      expect(houston.counts).toEqual({
        bands: 2,
        venues: 2,
        upcomingShows: 1,
        followers: 0,
      });
    });

    it("clamps an oversized limit", async () => {
      const res = await request(app).get("/scenes?limit=100000");
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100);
    });

    it("filters by state, accepting either spelling", async () => {
      const byCode = await request(app).get("/scenes?state=TX");
      const byName = await request(app).get("/scenes?state=Texas");

      const slugs = (r: any) => r.body.scenes.map((s: any) => s.slug).sort();
      expect(slugs(byCode)).toContain("houston-tx");
      expect(slugs(byName)).toEqual(slugs(byCode));
    });

    it("searches by name or city", async () => {
      const res = await request(app).get("/scenes?q=hous");
      expect(res.body.scenes.map((s: any) => s.slug)).toEqual(["houston-tx"]);
    });

    it("filters to curated scenes", async () => {
      const res = await request(app).get("/scenes?curatedOnly=true");
      expect(res.body.scenes.map((s: any) => s.slug)).toEqual(["houston-tx"]);
    });

    it("sorts by distance and reports it", async () => {
      // A point just outside Houston: Houston must come before Dallas.
      const res = await request(app).get("/scenes?lat=29.8&lng=-95.4&radiusKm=250&sort=distance");
      expect(res.status).toBe(200);

      const slugs = res.body.scenes.map((s: any) => s.slug);
      expect(slugs[0]).toBe("houston-tx");
      expect(res.body.scenes[0].distanceKm).toBeLessThan(10);
    });

    it("excludes scenes outside the radius", async () => {
      const res = await request(app).get("/scenes?lat=29.8&lng=-95.4&radiusKm=50&sort=distance");
      expect(res.body.scenes.map((s: any) => s.slug)).not.toContain("dallas-tx");
    });

    it("rejects sort=distance without coordinates", async () => {
      const res = await request(app).get("/scenes?sort=distance");
      expect(res.status).toBe(400);
    });

    it("rejects lat without lng", async () => {
      const res = await request(app).get("/scenes?lat=29.8");
      expect(res.status).toBe(400);
    });

    it("rejects an unknown sort", async () => {
      const res = await request(app).get("/scenes?sort=bogus");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /scenes/:slug", () => {
    it("returns the scene with counts and top genres", async () => {
      const res = await request(app).get("/scenes/houston-tx");
      expect(res.status).toBe(200);

      expect(res.body).toMatchObject({
        slug: "houston-tx",
        city: "Houston",
        state: "TX",
        bio: "Bayou City",
        isCurated: true,
      });
      expect(res.body.counts).toMatchObject({
        bands: 2,
        venues: 2,
        upcomingShows: 1,
        people: 1,
      });

      const genreSlugs = res.body.topGenres.map((g: any) => g.slug).sort();
      expect(genreSlugs).toEqual(["dream-pop", "hardcore", "shoegaze"]);

      const shoegaze = res.body.topGenres.find((g: any) => g.slug === "shoegaze");
      expect(shoegaze.bandCount).toBe(1);
    });

    it("404s on an unknown slug", async () => {
      const res = await request(app).get("/scenes/nowhere-zz");
      expect(res.status).toBe(404);
    });

    it("does not let /:slug swallow the literal routes", async () => {
      // Route ordering regression: /cities and /following must not be read as slugs.
      expect((await request(app).get("/scenes/cities")).status).toBe(200);
      expect((await request(app).get("/scenes/following?followerId=x&followerType=user")).status).toBe(200);
    });
  });

  describe("GET /scenes/by-location", () => {
    it("returns the same payload as /scenes/:slug", async () => {
      const bySlug = await request(app).get("/scenes/houston-tx");
      const byLoc = await request(app).get("/scenes/by-location?city=Houston&state=TX");

      expect(byLoc.status).toBe(200);
      expect(byLoc.body.id).toBe(bySlug.body.id);
    });

    it("matches a spelled-out state", async () => {
      const res = await request(app).get("/scenes/by-location?city=Houston&state=Texas");
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe("houston-tx");
    });

    it("404s on an unknown city", async () => {
      const res = await request(app).get("/scenes/by-location?city=Nowhere&state=ZZ");
      expect(res.status).toBe(404);
    });

    it("400s without city and state", async () => {
      expect((await request(app).get("/scenes/by-location?city=Houston")).status).toBe(400);
    });
  });

  describe("GET /scenes/:slug/bands", () => {
    it("returns only bands in that scene", async () => {
      const res = await request(app).get("/scenes/houston-tx/bands");
      expect(res.status).toBe(200);

      const names = res.body.items.map((b: any) => b.name).sort();
      expect(names).toEqual(["Gaze Band", "Rage Band"]);
      expect(names).not.toContain("Dallas Band");
    });

    it("filters by genre slug", async () => {
      const res = await request(app).get("/scenes/houston-tx/bands?genre=shoegaze");
      expect(res.body.items.map((b: any) => b.name)).toEqual(["Gaze Band"]);
    });

    it("accepts a display name or alias for the genre", async () => {
      const bySlug = await request(app).get("/scenes/houston-tx/bands?genre=shoegaze");
      const byName = await request(app).get("/scenes/houston-tx/bands?genre=Shoegaze");
      const byAlias = await request(app).get("/scenes/houston-tx/bands?genre=nugaze");

      const ids = (r: any) => r.body.items.map((b: any) => b.id);
      expect(ids(byName)).toEqual(ids(bySlug));
      expect(ids(byAlias)).toEqual(ids(bySlug));
    });

    it("returns an empty page for an unknown genre rather than 400", async () => {
      const res = await request(app).get("/scenes/houston-tx/bands?genre=not-a-real-genre");
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it("embeds resolved genres on each band", async () => {
      const res = await request(app).get("/scenes/houston-tx/bands?genre=shoegaze");
      expect(res.body.items[0].genres.map((g: any) => g.slug)).toEqual(["shoegaze", "dream-pop"]);
    });

    it("clamps the limit and 404s an unknown scene", async () => {
      expect((await request(app).get("/scenes/houston-tx/bands?limit=99999")).body.limit).toBe(100);
      expect((await request(app).get("/scenes/nowhere-zz/bands")).status).toBe(404);
    });
  });

  describe("GET /scenes/:slug/venues", () => {
    it("filters by capacity range", async () => {
      const big = await request(app).get("/scenes/houston-tx/venues?minCapacity=500");
      expect(big.body.items.map((v: any) => v.name)).toEqual(["Big Room"]);

      const small = await request(app).get("/scenes/houston-tx/venues?maxCapacity=500");
      expect(small.body.items.map((v: any) => v.name)).toEqual(["Tiny Room"]);
    });

    it("returns both without a filter", async () => {
      const res = await request(app).get("/scenes/houston-tx/venues");
      expect(res.body.items).toHaveLength(2);
    });
  });

  describe("GET /scenes/:slug/people", () => {
    it("returns people with crafts in that scene", async () => {
      const res = await request(app).get("/scenes/houston-tx/people");
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].crafts[0]).toMatchObject({
        craft: "PHOTOGRAPHER",
        forHire: true,
      });
    });

    it("filters by craft and forHire", async () => {
      const match = await request(app).get("/scenes/houston-tx/people?craft=PHOTOGRAPHER&forHire=true");
      expect(match.body.items).toHaveLength(1);

      const miss = await request(app).get("/scenes/houston-tx/people?craft=PROMOTER");
      expect(miss.body.items).toEqual([]);

      const notForHire = await request(app).get("/scenes/houston-tx/people?forHire=false");
      expect(notForHire.body.items).toEqual([]);
    });

    it("400s on an unknown craft", async () => {
      const res = await request(app).get("/scenes/houston-tx/people?craft=WIZARD");
      expect(res.status).toBe(400);
    });

    it("never exposes a password or email", async () => {
      const res = await request(app).get("/scenes/houston-tx/people");
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("password");
      expect(body).not.toContain("@test.com");
    });
  });

  describe("GET /scenes/:slug/shows", () => {
    it("returns upcoming shows by default and excludes past ones", async () => {
      const res = await request(app).get("/scenes/houston-tx/shows");
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(new Date(res.body.items[0].date).getTime()).toBeGreaterThan(Date.now());
    });

    it("returns past shows with ?past=true", async () => {
      const res = await request(app).get("/scenes/houston-tx/shows?past=true");
      expect(res.body.items).toHaveLength(1);
      expect(new Date(res.body.items[0].date).getTime()).toBeLessThan(Date.now());
    });

    it("filters by the genre of the lineup", async () => {
      const hit = await request(app).get("/scenes/houston-tx/shows?genre=shoegaze");
      expect(hit.body.items).toHaveLength(1);

      const miss = await request(app).get("/scenes/houston-tx/shows?genre=hardcore");
      expect(miss.body.items).toEqual([]);
    });

    it("narrows by dateRange", async () => {
      // The show is 10 days out: inside "month", outside "today".
      expect((await request(app).get("/scenes/houston-tx/shows?dateRange=month")).body.items).toHaveLength(1);
      expect((await request(app).get("/scenes/houston-tx/shows?dateRange=today")).body.items).toEqual([]);
    });

    it("400s on an unknown dateRange", async () => {
      const res = await request(app).get("/scenes/houston-tx/shows?dateRange=fortnight");
      expect(res.status).toBe(400);
    });
  });

  describe("scene follows", () => {
    let mallory: TestUser;
    let aliceBandId: string;

    beforeAll(async () => {
      mallory = await registerUser({ username: "mallory_scene", city: "Houston", state: "TX" });
      aliceBandId = await createBand(alice, "Alice Follow Band");
    });

    const clearFollows = () => prisma.sceneFollow.deleteMany({});

    describe("POST /scenes/follow", () => {
      it("follows by sceneId", async () => {
        await clearFollows();

        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(200);
        expect(res.body.scene).toMatchObject({ slug: "houston-tx", city: "Houston", state: "TX" });

        const rows = await prisma.sceneFollow.findMany({ where: { followerId: alice.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].sceneId).toBe(houstonId);
      });

      it("follows by slug", async () => {
        await clearFollows();

        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ slug: "dallas-tx", followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(200);
        expect(res.body.scene.slug).toBe("dallas-tx");
      });

      it("still accepts the legacy city/state body and stores a real sceneId", async () => {
        // This is the shape the shipped app sends. It must keep working.
        await clearFollows();

        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ city: "Houston", state: "TX", country: "USA", followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(200);

        const row = await prisma.sceneFollow.findFirstOrThrow({ where: { followerId: alice.id } });
        expect(row.sceneId).toBe(houstonId);
      });

      it("creates the scene when following a city nothing has reached yet", async () => {
        await clearFollows();

        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ city: "Lubbock", state: "TX", followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(200);
        expect(res.body.scene.slug).toBe("lubbock-tx");
        expect(await prisma.scene.findUnique({ where: { slug: "lubbock-tx" } })).not.toBeNull();
      });

      it("is idempotent", async () => {
        await clearFollows();

        const body = { sceneId: houstonId, followerId: alice.id, followerType: "user" };
        await request(app).post("/scenes/follow").set(auth(alice.token)).send(body);
        const second = await request(app).post("/scenes/follow").set(auth(alice.token)).send(body);

        expect(second.status).toBe(200);
        expect(await prisma.sceneFollow.count({ where: { followerId: alice.id } })).toBe(1);
      });

      it("404s an unknown sceneId or slug rather than creating one", async () => {
        const byId = await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: "does-not-exist", followerId: alice.id, followerType: "user" });
        expect(byId.status).toBe(404);

        const bySlug = await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ slug: "nowhere-zz", followerId: alice.id, followerType: "user" });
        expect(bySlug.status).toBe(404);

        expect(await prisma.scene.findUnique({ where: { slug: "nowhere-zz" } })).toBeNull();
      });

      it("400s when no scene is identified at all", async () => {
        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ followerId: alice.id, followerType: "user" });
        expect(res.status).toBe(400);
      });

      it("401s without a token", async () => {
        const res = await request(app)
          .post("/scenes/follow")
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });
        expect(res.status).toBe(401);
      });

      it("refuses to follow as another user, and writes nothing", async () => {
        await clearFollows();

        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(mallory.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(403);
        expect(await prisma.sceneFollow.count({ where: { followerId: alice.id } })).toBe(0);
      });

      it("refuses to follow as a band the caller is not in, and writes nothing", async () => {
        await clearFollows();

        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(mallory.token))
          .send({ sceneId: houstonId, followerId: aliceBandId, followerType: "band" });

        expect(res.status).toBe(403);
        expect(await prisma.sceneFollow.count({ where: { followerId: aliceBandId } })).toBe(0);
      });

      it("does not create a scene as a side effect of a refused follow", async () => {
        const res = await request(app)
          .post("/scenes/follow")
          .set(auth(mallory.token))
          .send({ city: "Amarillo", state: "TX", followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(403);
        expect(await prisma.scene.findUnique({ where: { slug: "amarillo-tx" } })).toBeNull();
      });
    });

    describe("DELETE /scenes/follow", () => {
      it("unfollows by sceneId", async () => {
        await clearFollows();
        await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        const res = await request(app)
          .delete("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(200);
        expect(await prisma.sceneFollow.count({ where: { followerId: alice.id } })).toBe(0);
      });

      it("still accepts the legacy city/state body", async () => {
        await clearFollows();
        await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ city: "Houston", state: "TX", followerId: alice.id, followerType: "user" });

        const res = await request(app)
          .delete("/scenes/follow")
          .set(auth(alice.token))
          .send({ city: "Houston", state: "TX", followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(200);
        expect(await prisma.sceneFollow.count({ where: { followerId: alice.id } })).toBe(0);
      });

      it("404s for a city with no scene, and does not create one", async () => {
        const res = await request(app)
          .delete("/scenes/follow")
          .set(auth(alice.token))
          .send({ city: "Abilene", state: "TX", followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(404);
        expect(await prisma.scene.findUnique({ where: { slug: "abilene-tx" } })).toBeNull();
      });

      it("refuses to unfollow on another profile's behalf, and the row survives", async () => {
        // The inverse of follow needs the same check -- this is the bug class
        // CONTRIBUTING calls out as the most common one in this codebase.
        await clearFollows();
        await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        const res = await request(app)
          .delete("/scenes/follow")
          .set(auth(mallory.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        expect(res.status).toBe(403);

        const rows = await prisma.sceneFollow.findMany({ where: { followerId: alice.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].sceneId).toBe(houstonId);
      });

      it("401s without a token", async () => {
        const res = await request(app)
          .delete("/scenes/follow")
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });
        expect(res.status).toBe(401);
      });
    });

    describe("GET /scenes/following", () => {
      it("keeps city and state at the top level, sourced from the scene", async () => {
        // The shipped ScenePage does scenes.some(s => s.city.toLowerCase() === ...).
        // The legacy columns are gone, so these can only come from the relation.
        await clearFollows();
        await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });


        const res = await request(app).get(
          `/scenes/following?followerId=${alice.id}&followerType=user`,
        );

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0]).toMatchObject({ city: "Houston", state: "TX" });
        expect(res.body[0].scene).toMatchObject({ slug: "houston-tx", name: "Houston" });
      });

      it("clamps an oversized limit", async () => {
        const res = await request(app).get(
          `/scenes/following?followerId=${alice.id}&followerType=user&limit=99999`,
        );
        expect(res.status).toBe(200);
        expect(res.body.length).toBeLessThanOrEqual(200);
      });

      it("400s without follower identification", async () => {
        expect((await request(app).get("/scenes/following")).status).toBe(400);
      });
    });

    describe("GET /scenes/:slug/following", () => {
      it("reports follow state directly", async () => {
        await clearFollows();

        const before = await request(app).get(
          `/scenes/houston-tx/following?followerId=${alice.id}&followerType=user`,
        );
        expect(before.body).toEqual({ isFollowing: false });

        await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        const after = await request(app).get(
          `/scenes/houston-tx/following?followerId=${alice.id}&followerType=user`,
        );
        expect(after.body).toEqual({ isFollowing: true });
      });

      it("404s an unknown scene", async () => {
        const res = await request(app).get(
          `/scenes/nowhere-zz/following?followerId=${alice.id}&followerType=user`,
        );
        expect(res.status).toBe(404);
      });
    });

    describe("follower counts", () => {
      it("appear on the scene detail payload", async () => {
        await clearFollows();
        await request(app)
          .post("/scenes/follow")
          .set(auth(alice.token))
          .send({ sceneId: houstonId, followerId: alice.id, followerType: "user" });

        const res = await request(app).get("/scenes/houston-tx");
        expect(res.body.counts.followers).toBe(1);

        await clearFollows();
      });
    });
  });

  describe("GET /scenes/cities", () => {
    it("keeps the legacy shape and adds slug", async () => {
      const res = await request(app).get("/scenes/cities");
      expect(res.status).toBe(200);

      const houston = res.body.find((c: any) => c.city === "Houston");
      expect(houston).toMatchObject({
        city: "Houston",
        state: "TX",
        lat: 29.7604,
        lng: -95.3698,
        venueCount: 2,
        slug: "houston-tx",
      });
    });

    it("omits scenes with no coordinates", async () => {
      const res = await request(app).get("/scenes/cities");
      expect(res.body.every((c: any) => c.lat != null && c.lng != null)).toBe(true);
    });
  });
});
