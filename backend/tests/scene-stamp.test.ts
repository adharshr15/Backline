import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDatabase, registerUser, auth, futureDate, TestUser } from "./helpers";

/**
 * Every write path that carries a city/state must stamp sceneId, and must keep it
 * in step when the location changes. Discovery reads all key off sceneId, so a
 * missed stamp silently removes a profile or show from Explore.
 */
describe("sceneId stamping", () => {
  let alice: TestUser;

  beforeAll(async () => {
    await resetDatabase();
    alice = await registerUser({ username: "alice_stamp", name: "Alice", city: "Houston", state: "TX" });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  const sceneOf = async (id: string) =>
    prisma.scene.findUnique({ where: { id }, select: { slug: true, city: true, state: true } });

  describe("register", () => {
    it("stamps the new user's scene and creates it on first use", async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
      expect(user.sceneId).not.toBeNull();

      expect(await sceneOf(user.sceneId!)).toMatchObject({
        slug: "houston-tx",
        city: "Houston",
        state: "TX",
      });
    });

    it("reuses the existing scene for a second user in the same city", async () => {
      const bob = await registerUser({ username: "bob_stamp", city: "Houston", state: "TX" });

      const [a, b] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: alice.id } }),
        prisma.user.findUniqueOrThrow({ where: { id: bob.id } }),
      ]);
      expect(b.sceneId).toBe(a.sceneId);
    });

    it("treats differently-cased spellings of a city as one scene", async () => {
      const carol = await registerUser({ username: "carol_stamp", city: "houston", state: "tx" });

      const carolRow = await prisma.user.findUniqueOrThrow({ where: { id: carol.id } });
      const aliceRow = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
      expect(carolRow.sceneId).toBe(aliceRow.sceneId);

      expect(await prisma.scene.count({ where: { slug: "houston-tx" } })).toBe(1);
    });
  });

  describe("PUT /users/me", () => {
    it("moves the user to a new scene when the city changes", async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });

      const res = await request(app)
        .put("/users/me")
        .set(auth(alice.token))
        .send({ city: "Denton", state: "TX" });
      expect(res.status).toBe(200);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
      expect(after.sceneId).not.toBe(before.sceneId);
      expect(await sceneOf(after.sceneId!)).toMatchObject({ slug: "denton-tx" });

      // Put Alice back so later blocks read a stable location.
      await request(app)
        .put("/users/me")
        .set(auth(alice.token))
        .send({ city: "Houston", state: "TX" });
    });

    it("resolves against the merged location on a partial update", async () => {
      // Only `city` is sent; `state` has to come from the stored row or the
      // resolve returns null and the user falls out of every scene query.
      const res = await request(app)
        .put("/users/me")
        .set(auth(alice.token))
        .send({ city: "Austin" });
      expect(res.status).toBe(200);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
      expect(after.sceneId).not.toBeNull();
      expect(await sceneOf(after.sceneId!)).toMatchObject({ slug: "austin-tx" });

      await request(app)
        .put("/users/me")
        .set(auth(alice.token))
        .send({ city: "Houston", state: "TX" });
    });

    it("leaves sceneId alone when the update touches no location field", async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });

      await request(app).put("/users/me").set(auth(alice.token)).send({ bio: "hello" });

      const after = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
      expect(after.sceneId).toBe(before.sceneId);
    });
  });

  describe("bands", () => {
    it("stamps on create and re-stamps on update", async () => {
      const created = await request(app)
        .post("/bands")
        .set(auth(alice.token))
        .send({ name: "Stamp Band", city: "Houston", state: "TX", country: "USA" });
      expect(created.status).toBe(201);

      const bandId = created.body.id as string;
      const band = await prisma.band.findUniqueOrThrow({ where: { id: bandId } });
      expect(await sceneOf(band.sceneId!)).toMatchObject({ slug: "houston-tx" });

      const updated = await request(app)
        .put(`/bands/${bandId}`)
        .set(auth(alice.token))
        .send({ city: "San Antonio", state: "TX" });
      expect(updated.status).toBe(200);

      const moved = await prisma.band.findUniqueOrThrow({ where: { id: bandId } });
      expect(moved.sceneId).not.toBe(band.sceneId);
      expect(await sceneOf(moved.sceneId!)).toMatchObject({ slug: "san-antonio-tx" });
    });

    it("leaves sceneId null for a band with no location", async () => {
      // Band.city/state are nullable, so a scene cannot be named.
      const created = await request(app)
        .post("/bands")
        .set(auth(alice.token))
        .send({ name: "Placeless Band" });
      expect(created.status).toBe(201);

      const band = await prisma.band.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(band.sceneId).toBeNull();
    });
  });

  describe("venues", () => {
    it("stamps on create and re-stamps on update", async () => {
      const created = await request(app)
        .post("/venues")
        .set(auth(alice.token))
        .send({ name: "Stamp Venue", city: "Houston", state: "TX", country: "USA" });
      expect(created.status).toBe(201);

      const venueId = created.body.id as string;
      const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
      expect(await sceneOf(venue.sceneId!)).toMatchObject({ slug: "houston-tx" });

      const updated = await request(app)
        .put(`/venues/${venueId}`)
        .set(auth(alice.token))
        .send({ city: "Dallas", state: "TX" });
      expect(updated.status).toBe(200);

      const moved = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
      expect(await sceneOf(moved.sceneId!)).toMatchObject({ slug: "dallas-tx" });
    });
  });

  describe("shows", () => {
    it("stamps from the show's own city, not the venue's", async () => {
      // A venue in Houston hosting a show recorded in Denton: the show belongs to
      // the Denton scene. Deriving through the venue would put it in Houston.
      const venueRes = await request(app)
        .post("/venues")
        .set(auth(alice.token))
        .send({ name: "Cross-city Venue", city: "Houston", state: "TX", country: "USA" });

      const showRes = await request(app)
        .post("/shows")
        .set(auth(alice.token))
        .send({
          date: futureDate(),
          doors: futureDate(),
          city: "Denton",
          state: "TX",
          country: "USA",
          venueId: venueRes.body.id,
          creatorUserId: alice.id,
        });
      expect(showRes.status).toBe(201);

      const show = await prisma.show.findUniqueOrThrow({ where: { id: showRes.body.id } });
      expect(await sceneOf(show.sceneId!)).toMatchObject({ slug: "denton-tx" });
    });

    it("stamps a show with no venue at all", async () => {
      // Show.venueId is nullable -- DIY and house shows must still be discoverable.
      const res = await request(app)
        .post("/shows")
        .set(auth(alice.token))
        .send({
          date: futureDate(),
          doors: futureDate(),
          city: "Waco",
          state: "TX",
          country: "USA",
          venueName: "Somebody's basement",
          creatorUserId: alice.id,
        });
      expect(res.status).toBe(201);

      const show = await prisma.show.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(show.venueId).toBeNull();
      expect(await sceneOf(show.sceneId!)).toMatchObject({ slug: "waco-tx" });
    });

    it("re-stamps when the show is moved to another city", async () => {
      const created = await request(app)
        .post("/shows")
        .set(auth(alice.token))
        .send({
          date: futureDate(),
          doors: futureDate(),
          city: "Waco",
          state: "TX",
          country: "USA",
          creatorUserId: alice.id,
        });

      const updated = await request(app)
        .put(`/shows/${created.body.id}`)
        .set(auth(alice.token))
        .send({ city: "El Paso", state: "TX" });
      expect(updated.status).toBe(200);

      const show = await prisma.show.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(await sceneOf(show.sceneId!)).toMatchObject({ slug: "el-paso-tx" });
    });
  });

  describe("scene creation", () => {
    it("marks auto-created scenes as uncurated", async () => {
      const scene = await prisma.scene.findUniqueOrThrow({ where: { slug: "houston-tx" } });
      expect(scene.isCurated).toBe(false);
      expect(scene.name).toBe("Houston");
    });

    it("titlecases a multi-word city for display", async () => {
      const scene = await prisma.scene.findUniqueOrThrow({ where: { slug: "san-antonio-tx" } });
      expect(scene.name).toBe("San Antonio");
    });
  });
});
