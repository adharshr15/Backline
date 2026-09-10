import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDatabase, registerUser, createBand, seedGenres, auth, TestUser } from "./helpers";

/**
 * Band genres are written through the taxonomy on create and update.
 *
 * Before this, POST/PUT /bands wrote only the free-text Band.genre column, and
 * nothing at runtime populated BandGenre -- the backfill script was the only
 * writer. A band created in the app was therefore invisible to every genre
 * filter, scene facet and explore genre section.
 *
 * Kept out of band.test.ts: that suite hand-rolls its cleanup and does not clear
 * BandGenre, so genre rows would make its own band.deleteMany() fail.
 */
describe("band genres", () => {
  let owner: TestUser;
  let stranger: TestUser;

  const slugsOf = (body: any): string[] => body.genres.map((g: any) => g.slug);

  const rowsFor = (bandId: string) =>
    prisma.bandGenre.findMany({
      where: { bandId },
      orderBy: { position: "asc" },
      select: { position: true, genre: { select: { slug: true } } },
    });

  const newBand = (body: Record<string, unknown>) =>
    request(app)
      .post("/bands")
      .set(auth(owner.token))
      .send({ city: "Austin", state: "TX", country: "USA", ...body });

  beforeAll(async () => {
    await resetDatabase();
    await seedGenres();
    owner = await registerUser({ username: "genre_owner" });
    stranger = await registerUser({ username: "genre_stranger" });
  });

  describe("POST /bands", () => {
    it("writes BandGenre rows in the order given, first as primary", async () => {
      const res = await newBand({ name: "Heel", genres: ["shoegaze", "dream-pop"] });

      expect(res.status).toBe(201);
      expect(slugsOf(res.body)).toEqual(["shoegaze", "dream-pop"]);
      expect(await rowsFor(res.body.id)).toEqual([
        { position: 0, genre: { slug: "shoegaze" } },
        { position: 1, genre: { slug: "dream-pop" } },
      ]);
    });

    it("accepts genres as a JSON string, the way multipart FormData sends them", async () => {
      // The app creates bands with FormData, which cannot carry an array.
      const res = await request(app)
        .post("/bands")
        .set(auth(owner.token))
        .field("name", "Form Band")
        .field("city", "Austin")
        .field("state", "TX")
        .field("country", "USA")
        .field("genres", JSON.stringify(["post-punk"]));

      expect(res.status).toBe(201);
      expect(slugsOf(res.body)).toEqual(["post-punk"]);
    });

    it("collapses duplicate slugs, keeping first-seen order", async () => {
      const res = await newBand({ name: "Dupes", genres: ["shoegaze", "rock", "shoegaze"] });

      expect(res.status).toBe(201);
      expect(slugsOf(res.body)).toEqual(["shoegaze", "rock"]);
    });

    it("creates a band with no genres when none are sent", async () => {
      const res = await newBand({ name: "Untagged" });

      expect(res.status).toBe(201);
      expect(res.body.genres).toEqual([]);
    });

    it("rejects more than three genres and creates nothing", async () => {
      const res = await newBand({
        name: "Too Many",
        genres: ["shoegaze", "rock", "punk", "jazz"],
      });

      expect(res.status).toBe(400);
      expect(await prisma.band.count({ where: { name: "Too Many" } })).toBe(0);
    });

    it("rejects an unknown genre slug and creates nothing", async () => {
      // A filter tolerates a typo; a write must not silently drop what was asked for.
      const res = await newBand({ name: "Typo", genres: ["shoegaze", "not-a-genre"] });

      expect(res.status).toBe(400);
      expect(await prisma.band.count({ where: { name: "Typo" } })).toBe(0);
    });

    it("rejects genres that are not a list of slugs", async () => {
      const res = await newBand({ name: "Malformed", genres: "{not json" });

      expect(res.status).toBe(400);
      expect(await prisma.band.count({ where: { name: "Malformed" } })).toBe(0);
    });
  });

  describe("PUT /bands/:id", () => {
    let bandId: string;

    const put = (token: string, body: Record<string, unknown>) =>
      request(app).put(`/bands/${bandId}`).set(auth(token)).send(body);

    beforeAll(async () => {
      bandId = await createBand(owner, "Edit Me");
      const res = await put(owner.token, { genres: ["rock"] });
      expect(res.status).toBe(200);
    });

    it("replaces the whole set, in the order given", async () => {
      const res = await put(owner.token, { genres: ["post-punk", "rock"] });

      expect(res.status).toBe(200);
      expect(slugsOf(res.body)).toEqual(["post-punk", "rock"]);
      expect(await rowsFor(bandId)).toEqual([
        { position: 0, genre: { slug: "post-punk" } },
        { position: 1, genre: { slug: "rock" } },
      ]);
    });

    it("leaves genres untouched when the field is omitted", async () => {
      const res = await put(owner.token, { bio: "A partial update" });

      expect(res.status).toBe(200);
      expect(slugsOf(res.body)).toEqual(["post-punk", "rock"]);
    });

    it("accepts a JSON string, the way multipart FormData sends it", async () => {
      const res = await request(app)
        .put(`/bands/${bandId}`)
        .set(auth(owner.token))
        .field("genres", JSON.stringify(["jazz"]));

      expect(res.status).toBe(200);
      expect(slugsOf(res.body)).toEqual(["jazz"]);
    });

    it("rejects an unknown slug without touching the existing set", async () => {
      const res = await put(owner.token, { genres: ["not-a-genre"] });

      expect(res.status).toBe(400);
      expect((await rowsFor(bandId)).map(r => r.genre.slug)).toEqual(["jazz"]);
    });

    it("refuses a non-member without touching the existing set", async () => {
      const res = await put(stranger.token, { genres: ["metal"] });

      expect(res.status).toBe(403);
      expect((await rowsFor(bandId)).map(r => r.genre.slug)).toEqual(["jazz"]);
    });

    it("clears the set with an empty array", async () => {
      const res = await put(owner.token, { genres: [] });

      expect(res.status).toBe(200);
      expect(res.body.genres).toEqual([]);
      expect(await rowsFor(bandId)).toEqual([]);
    });
  });

  describe("reads", () => {
    let bandId: string;

    beforeAll(async () => {
      const res = await newBand({ name: "Readable", genres: ["emo", "punk"] });
      bandId = res.body.id;
    });

    it("GET /bands/:id returns genres in position order", async () => {
      const res = await request(app).get(`/bands/${bandId}`);

      expect(res.status).toBe(200);
      expect(slugsOf(res.body)).toEqual(["emo", "punk"]);
      expect(res.body.genres[0]).toEqual({ slug: "emo", name: "Emo" });
    });

    it("GET /auth/me returns genres on each band membership", async () => {
      const res = await request(app).get("/auth/me").set(auth(owner.token));

      expect(res.status).toBe(200);
      const band = res.body.bandMemberships.find((m: any) => m.band.id === bandId).band;
      expect(slugsOf(band)).toEqual(["emo", "punk"]);
    });

    it("GET /users/me/profiles returns genres on each band", async () => {
      const res = await request(app).get("/users/me/profiles").set(auth(owner.token));

      expect(res.status).toBe(200);
      const band = res.body.bands.find((b: any) => b.id === bandId);
      expect(slugsOf(band)).toEqual(["emo", "punk"]);
    });
  });
});
