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
  createPost,
  TestUser,
} from "./helpers";

describe("GET /explore", () => {
  let alice: TestUser;      // Houston user
  let mallory: TestUser;    // unaffiliated
  let houstonId: string;
  let dallasId: string;

  let aliceBandId: string;  // Houston, shoegaze
  let gazeBandId: string;
  let hardcoreBandId: string;
  let dallasBandId: string;

  let upcomingShowId: string;

  const explore = (user: TestUser, qs = "") =>
    request(app).get(`/explore${qs ? `?${qs}` : ""}`).set(auth(user.token));

  const section = (body: any, key: string) =>
    body.sections.find((s: any) => s.key === key);

  beforeAll(async () => {
    await resetDatabase();
    await seedGenres();

    alice = await registerUser({ username: "alice_explore", city: "Houston", state: "TX" });
    mallory = await registerUser({ username: "mallory_explore", city: "Houston", state: "TX" });

    houstonId = (await prisma.scene.findUniqueOrThrow({ where: { slug: "houston-tx" } })).id;
    await prisma.scene.update({
      where: { id: houstonId },
      data: { latitude: 29.7604, longitude: -95.3698 },
    });

    dallasId = await createScene({
      city: "Dallas",
      state: "TX",
      slug: "dallas-tx",
      latitude: 32.7767,
      longitude: -96.797,
    });

    aliceBandId = await createBand(alice, "Alice Band");
    gazeBandId = await createBand(alice, "Gaze Band");
    hardcoreBandId = await createBand(alice, "Rage Band");
    await prisma.band.updateMany({
      where: { id: { in: [aliceBandId, gazeBandId, hardcoreBandId] } },
      data: { sceneId: houstonId, city: "Houston", state: "TX" },
    });
    await attachGenres(aliceBandId, ["shoegaze"]);
    await attachGenres(gazeBandId, ["shoegaze"]);
    await attachGenres(hardcoreBandId, ["hardcore"]);

    dallasBandId = await createBand(alice, "Dallas Band");
    await prisma.band.update({
      where: { id: dallasBandId },
      data: { sceneId: dallasId, city: "Dallas", state: "TX" },
    });

    const venueId = await createVenue(alice, "Houston Room");
    await prisma.venue.update({
      where: { id: venueId },
      data: { sceneId: houstonId, city: "Houston", state: "TX" },
    });

    await setCrafts(alice, [{ craft: "PHOTOGRAPHER", forHire: true, headline: "Live shows" }]);

    const upcoming = await prisma.show.create({
      data: {
        date: new Date(futureDate(7)),
        doors: new Date(futureDate(7)),
        city: "Houston",
        state: "TX",
        country: "USA",
        sceneId: houstonId,
        venueName: "Houston Room",
      },
    });
    upcomingShowId = upcoming.id;

    // Past show and an out-of-scene show: neither should appear.
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
    await prisma.show.create({
      data: {
        date: new Date(futureDate(7)),
        doors: new Date(futureDate(7)),
        city: "Dallas",
        state: "TX",
        country: "USA",
        sceneId: dallasId,
      },
    });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("auth", () => {
    it("401s without a token", async () => {
      expect((await request(app).get("/explore")).status).toBe(401);
    });

    it("refuses to browse as a band the caller is not in", async () => {
      const res = await explore(mallory, `profileType=band&profileId=${aliceBandId}`);
      expect(res.status).toBe(403);
    });

    it("refuses to browse as another user", async () => {
      const res = await explore(mallory, `profileType=user&profileId=${alice.id}`);
      expect(res.status).toBe(403);
    });

    it("400s on an unknown profileType", async () => {
      expect((await explore(alice, "profileType=wizard")).status).toBe(400);
    });
  });

  describe("shape", () => {
    it("returns a list of section descriptors", async () => {
      const res = await explore(alice);
      expect(res.status).toBe(200);

      expect(Array.isArray(res.body.sections)).toBe(true);
      expect(res.body.sections.length).toBeGreaterThan(0);

      for (const s of res.body.sections) {
        expect(s).toHaveProperty("key");
        expect(s).toHaveProperty("title");
        expect(s).toHaveProperty("kind");
        expect(s).toHaveProperty("items");
        expect(s.seeMore).toHaveProperty("path");
        expect(s.seeMore).toHaveProperty("params");
      }
    });

    it("gives every item the shape DiscoverSection binds to", async () => {
      const res = await explore(alice);

      for (const s of res.body.sections) {
        for (const item of s.items) {
          // The frontend binding contract. Asserted field by field on purpose.
          expect(item).toHaveProperty("id");
          expect(item).toHaveProperty("name");
          expect(item).toHaveProperty("subtitle");
          expect(item).toHaveProperty("profileImageUrl");
          expect(item).toHaveProperty("accountType");
          expect(item).toHaveProperty("type");
          expect(typeof item.name).toBe("string");
          expect(typeof item.subtitle).toBe("string");
        }
      }
    });

    it("reports the resolved location and its source", async () => {
      const res = await explore(alice);
      expect(res.body.location).toMatchObject({
        city: "Houston",
        state: "TX",
        source: "profile",
      });
      expect(res.body.location.scene).toMatchObject({ slug: "houston-tx" });
    });
  });

  describe("shows_near_you", () => {
    it("contains the upcoming local show", async () => {
      const res = await explore(alice);
      const shows = section(res.body, "shows_near_you");

      expect(shows.items.map((i: any) => i.id)).toEqual([upcomingShowId]);
    });

    it("excludes past shows and shows in another scene", async () => {
      const res = await explore(alice);
      const ids = section(res.body, "shows_near_you").items.map((i: any) => i.id);

      expect(ids).toHaveLength(1);
      for (const item of section(res.body, "shows_near_you").items) {
        expect(new Date(item.date).getTime()).toBeGreaterThan(Date.now());
      }
    });

    it("points seeMore at a real endpoint", async () => {
      const res = await explore(alice);
      expect(section(res.body, "shows_near_you").seeMore).toEqual({
        path: "/shows",
        params: { city: "Houston", state: "TX" },
      });
    });
  });

  describe("bands_near_you", () => {
    it("returns local bands only", async () => {
      const res = await explore(alice);
      const names = section(res.body, "bands_near_you").items.map((i: any) => i.name);

      expect(names).toContain("Gaze Band");
      expect(names).not.toContain("Dallas Band");
    });

    it("excludes the acting band from its own feed", async () => {
      const res = await explore(alice, `profileType=band&profileId=${aliceBandId}`);
      const ids = section(res.body, "bands_near_you").items.map((i: any) => i.id);

      expect(ids).not.toContain(aliceBandId);
      expect(ids).toContain(gazeBandId);
    });
  });

  describe("genre sections", () => {
    it("builds a facet section from the acting band's own genre", async () => {
      const res = await explore(alice, `profileType=band&profileId=${aliceBandId}`);
      const gaze = section(res.body, "genre:shoegaze");

      expect(gaze).toBeDefined();
      expect(gaze.title).toBe("Houston Shoegaze");
      expect(gaze.items.map((i: any) => i.id)).toEqual([gazeBandId]);
    });

    it("points the facet at the scene bands endpoint", async () => {
      const res = await explore(alice, `profileType=band&profileId=${aliceBandId}`);
      expect(section(res.body, "genre:shoegaze").seeMore).toEqual({
        path: "/scenes/houston-tx/bands",
        params: { genre: "shoegaze" },
      });
    });

    it("derives genres from followed bands for a user", async () => {
      await request(app).post("/follows").set(auth(mallory.token)).send({
        followerType: "USER",
        followeeType: "BAND",
        followeeId: hardcoreBandId,
      });

      const res = await explore(mallory);
      const hardcore = section(res.body, "genre:hardcore");

      expect(hardcore).toBeDefined();
      expect(hardcore.title).toBe("Houston Hardcore");
    });
  });

  describe("people_near_you", () => {
    it("includes local people with crafts", async () => {
      const res = await explore(alice);
      const people = section(res.body, "people_near_you");

      expect(people.items.map((i: any) => i.id)).toContain(alice.id);
      expect(people.items[0].subtitle).toContain("Photographer");
    });

    it("excludes people in another scene", async () => {
      const dana = await registerUser({ username: "dana_explore", city: "Dallas", state: "TX" });
      await setCrafts(dana, [{ craft: "PHOTOGRAPHER" }]);

      const res = await explore(alice);
      const ids = section(res.body, "people_near_you").items.map((i: any) => i.id);
      expect(ids).not.toContain(dana.id);
    });
  });

  describe("scenes_for_you", () => {
    it("suggests scenes the profile is not already in or following", async () => {
      const res = await explore(alice);
      const scenes = section(res.body, "scenes_for_you");

      const slugs = scenes.items.map((i: any) => i.slug);
      expect(slugs).toContain("dallas-tx");
      expect(slugs).not.toContain("houston-tx");
    });

    it("carries counts and a readable subtitle", async () => {
      const res = await explore(alice);
      const dallas = section(res.body, "scenes_for_you").items.find(
        (i: any) => i.slug === "dallas-tx",
      );

      expect(dallas.counts).toMatchObject({ bands: 1 });
      expect(dallas.subtitle).toBe("1 bands · 0 venues");
    });

    it("drops a scene once it is followed", async () => {
      await request(app).post("/scenes/follow").set(auth(alice.token)).send({
        sceneId: dallasId,
        followerId: alice.id,
        followerType: "user",
      });

      const res = await explore(alice);
      const scenes = section(res.body, "scenes_for_you");
      const slugs = scenes ? scenes.items.map((i: any) => i.slug) : [];
      expect(slugs).not.toContain("dallas-tx");

      await request(app).delete("/scenes/follow").set(auth(alice.token)).send({
        sceneId: dallasId,
        followerId: alice.id,
        followerType: "user",
      });
    });
  });

  describe("location resolution", () => {
    it("honours explicit city and state", async () => {
      const res = await explore(alice, "city=Dallas&state=TX");

      expect(res.body.location).toMatchObject({ city: "Dallas", source: "query" });
      const names = section(res.body, "bands_near_you").items.map((i: any) => i.name);
      expect(names).toEqual(["Dallas Band"]);
    });

    it("resolves coordinates to the nearest scene", async () => {
      const res = await explore(alice, "lat=29.76&lng=-95.36&radiusKm=50");
      expect(res.body.location).toMatchObject({ city: "Houston", source: "coords" });
    });

    it("400s on lat without lng", async () => {
      expect((await explore(alice, "lat=29.76")).status).toBe(400);
    });

    it("400s on city without state", async () => {
      expect((await explore(alice, "city=Houston")).status).toBe(400);
    });

    it("omits location sections entirely when nothing resolves", async () => {
      // Register requires a city, so clear it directly.
      const nomad = await registerUser({ username: "nomad_explore" });
      await prisma.user.update({
        where: { id: nomad.id },
        data: { city: null, state: null, sceneId: null },
      });

      const res = await explore(nomad);
      expect(res.status).toBe(200);
      expect(res.body.location).toBeNull();

      // Omitted, not returned empty -- the client must never render an empty rail.
      expect(section(res.body, "shows_near_you")).toBeUndefined();
      expect(section(res.body, "bands_near_you")).toBeUndefined();

      // Scenes to follow is not location-dependent and still renders.
      expect(section(res.body, "scenes_for_you")).toBeDefined();
    });
  });

  describe("posts", () => {
    const FILLER = 80;
    let localIds: string[];
    let gazePostId: string;
    let dallasPostId: string;
    let alicePostId: string;
    let deletedPostId: string;
    let eligibleForAlice: number;

    const postIds = (body: any): string[] =>
      body.sections
        .filter((s: any) => s.kind === "POSTS")
        .flatMap((s: any) => s.items.map((i: any) => i.id));

    const morePosts = (user: TestUser, qs = "") =>
      request(app).get(`/explore/posts${qs ? `?${qs}` : ""}`).set(auth(user.token));

    beforeAll(async () => {
      const venueId = (await prisma.venue.findFirstOrThrow({ where: { name: "Houston Room" } })).id;
      // Explicit timestamps throughout: the DB container's clock is not the app's.
      const now = new Date();

      gazePostId = await createPost({
        uploader: alice, ownerType: "BAND", ownerId: gazeBandId,
        sceneId: houstonId, caption: "Gaze at the Room", createdAt: now,
      });
      localIds = [
        gazePostId,
        await createPost({ uploader: alice, ownerType: "BAND", ownerId: hardcoreBandId, sceneId: houstonId, createdAt: now }),
        await createPost({ uploader: alice, ownerType: "VENUE", ownerId: venueId, sceneId: houstonId, createdAt: now }),
        await createPost({ uploader: mallory, ownerType: "USER", ownerId: mallory.id, sceneId: houstonId, createdAt: now }),
      ];
      dallasPostId = await createPost({
        uploader: alice, ownerType: "BAND", ownerId: dallasBandId, sceneId: dallasId, createdAt: now,
      });
      alicePostId = await createPost({
        uploader: alice, ownerType: "USER", ownerId: alice.id, sceneId: houstonId, createdAt: now,
      });
      deletedPostId = await createPost({
        uploader: mallory, ownerType: "USER", ownerId: mallory.id,
        sceneId: houstonId, createdAt: now, deletedAt: now,
      });

      // Older, placeless filler: more than the grids /explore can embed, so a
      // cursor has to be issued.
      await prisma.post.createMany({
        data: Array.from({ length: FILLER }, (_, i) => ({
          url: `/uploads/filler-${i}.jpg`,
          uploaderUserId: mallory.id,
          ownerUserId: mallory.id,
          createdAt: new Date(now.getTime() - 10 * 86_400_000 - i * 1000),
        })),
      });

      // Everything except Alice's own post and the deleted one.
      eligibleForAlice = localIds.length + 1 + FILLER;
    });

    describe("in the feed", () => {
      it("puts a grid of posts straight after Shows Near You", async () => {
        const res = await explore(alice);
        expect(res.body.sections[0].key).toBe("shows_near_you");
        expect(res.body.sections[1]).toMatchObject({ key: "posts:1", kind: "POSTS" });
      });

      it("alternates rails and grids", async () => {
        const res = await explore(alice);
        res.body.sections.forEach((s: any, i: number) => {
          expect(s.kind === "POSTS").toBe(i % 2 === 1);
        });
      });

      it("fills grids in whole rows of three, nine at most", async () => {
        const res = await explore(alice);
        for (const s of res.body.sections.filter((s: any) => s.kind === "POSTS")) {
          expect(s.items.length).toBeLessThanOrEqual(9);
          expect(s.items.length % 3).toBe(0);
        }
      });

      it("ranks a local post above a non-local one of the same age", async () => {
        const ids = postIds((await explore(alice)).body);
        expect(ids).toContain(dallasPostId);
        for (const id of localIds) {
          expect(ids.indexOf(id)).toBeLessThan(ids.indexOf(dallasPostId));
        }
      });

      it("excludes the acting profile's own posts", async () => {
        const asAlice = postIds((await explore(alice)).body);
        expect(asAlice).not.toContain(alicePostId);

        // Browsing as the band hides the band's posts, not its member's.
        const asGaze = postIds(
          (await explore(alice, `profileType=band&profileId=${gazeBandId}`)).body,
        );
        expect(asGaze).not.toContain(gazePostId);
        expect(asGaze).toContain(alicePostId);
      });

      it("excludes deleted posts", async () => {
        expect(postIds((await explore(alice)).body)).not.toContain(deletedPostId);
      });

      it("gives a post item the binding shape plus its media", async () => {
        const res = await explore(alice);
        const item = res.body.sections
          .flatMap((s: any) => s.items)
          .find((i: any) => i.id === gazePostId);

        expect(item).toMatchObject({
          type: "POST",
          accountType: "BAND",
          name: "Gaze Band",
          subtitle: "Gaze at the Room",
          mediaType: "PHOTO",
        });
        expect(item.url).toMatch(/^\/uploads\//);
      });

      it("hands back a cursor while posts remain", async () => {
        const res = await explore(alice);
        expect(typeof res.body.postsCursor).toBe("string");
      });
    });

    describe("GET /explore/posts", () => {
      it("401s without a token", async () => {
        expect((await request(app).get("/explore/posts")).status).toBe(401);
      });

      it("refuses to browse as a band the caller is not in", async () => {
        const res = await morePosts(mallory, `profileType=band&profileId=${aliceBandId}`);
        expect(res.status).toBe(403);
      });

      it("400s on a malformed cursor", async () => {
        expect((await morePosts(alice, "cursor=not-a-cursor!!")).status).toBe(400);
      });

      it("400s on city without state", async () => {
        expect((await morePosts(alice, "city=Houston")).status).toBe(400);
      });

      it("pages through every eligible post exactly once", async () => {
        const first = await explore(alice);
        const seen = postIds(first.body);
        let cursor: string | null = first.body.postsCursor;

        while (cursor) {
          const page = await morePosts(alice, `cursor=${encodeURIComponent(cursor)}`);
          expect(page.status).toBe(200);
          seen.push(...page.body.items.map((i: any) => i.id));
          cursor = page.body.nextCursor;
        }

        expect(new Set(seen).size).toBe(seen.length);
        expect(seen).toHaveLength(eligibleForAlice - (eligibleForAlice % 3));
        expect(seen).not.toContain(alicePostId);
        expect(seen).not.toContain(deletedPostId);
      });

      it("does not slip a newer post into a scroll already under way", async () => {
        const first = await explore(alice);
        const late = await createPost({
          uploader: mallory, ownerType: "USER", ownerId: mallory.id,
          sceneId: houstonId, createdAt: new Date(),
        });

        const page = await morePosts(alice, `cursor=${encodeURIComponent(first.body.postsCursor)}`);
        expect(page.body.items.map((i: any) => i.id)).not.toContain(late);

        // A fresh load does see it -- and ranks it near the top.
        expect(postIds((await explore(alice)).body)).toContain(late);
      });

      it("serves whole grids and clamps the page size", async () => {
        expect((await morePosts(alice, "limit=1")).body.items).toHaveLength(9);
        expect((await morePosts(alice, "limit=1000")).body.items.length).toBeLessThanOrEqual(27);
      });

      it("never leaks a password or email", async () => {
        const body = JSON.stringify((await morePosts(alice, "limit=27")).body);
        expect(body).not.toContain("password");
        expect(body).not.toContain("@test.com");
      });
    });
  });

  describe("bounds", () => {
    it("clamps items per section", async () => {
      const res = await explore(alice, "limit=1000");

      for (const s of res.body.sections) {
        expect(s.items.length).toBeLessThanOrEqual(20);
      }
    });

    it("caps the number of rails", async () => {
      const res = await explore(alice);
      // Post grids sit between rails and are not rails; the cap is on rails.
      const rails = res.body.sections.filter((s: any) => s.kind !== "POSTS");
      expect(rails.length).toBeLessThanOrEqual(8);
    });
  });

  describe("disclosure", () => {
    it("never leaks a password or email", async () => {
      const res = await explore(alice);
      const body = JSON.stringify(res.body);

      expect(body).not.toContain("password");
      expect(body).not.toContain("@test.com");
    });
  });
});
