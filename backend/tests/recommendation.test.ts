import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDatabase, registerUser, auth, setCrafts, createBand, createVenue, TestUser } from "./helpers";

/**
 * Craft recommendations -- any profile (user, band or venue) vouching for a user
 * in one of the crafts they list.
 */
describe("craft recommendations", () => {
  let ana: TestUser;   // photographer + DJ, the one being recommended
  let ben: TestUser;   // recommends as himself
  let cara: TestUser;  // manages a band and a venue
  let bandId: string;
  let venueId: string;

  const recommend = (as: TestUser, target: string, craft: string, recommenderType: string, recommenderId: string) =>
    request(app)
      .post(`/users/${target}/crafts/${craft}/recommend`)
      .set(auth(as.token))
      .send({ recommenderType, recommenderId });

  const unrecommend = (as: TestUser, target: string, craft: string, recommenderType: string, recommenderId: string) =>
    request(app)
      .delete(`/users/${target}/crafts/${craft}/recommend`)
      .set(auth(as.token))
      .send({ recommenderType, recommenderId });

  const list = (as: TestUser, target: string, viewer?: { viewerType: string; viewerId: string }) =>
    request(app)
      .get(`/users/${target}/recommendations`)
      .query(viewer ?? {})
      .set(auth(as.token));

  const entry = (body: any[], craft: string) => body.find(r => r.craft === craft);

  beforeAll(async () => {
    await resetDatabase();

    ana = await registerUser({ username: "ana_rec", name: "Ana Reyes" });
    ben = await registerUser({ username: "ben_rec", name: "Ben Ito" });
    cara = await registerUser({ username: "cara_rec", name: "Cara Moss" });

    await setCrafts(ana, [{ craft: "PHOTOGRAPHER", forHire: true }, { craft: "DJ" }]);
    bandId = await createBand(cara);
    venueId = await createVenue(cara);
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("POST /users/:id/crafts/:craft/recommend", () => {
    it("401s without a token", async () => {
      const res = await request(app)
        .post(`/users/${ana.id}/crafts/PHOTOGRAPHER/recommend`)
        .send({ recommenderType: "USER", recommenderId: ben.id });
      expect(res.status).toBe(401);
    });

    it("recommends as yourself", async () => {
      const res = await recommend(ben, ana.id, "PHOTOGRAPHER", "USER", ben.id);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ recommended: true, count: 1 });
    });

    it("is idempotent", async () => {
      const res = await recommend(ben, ana.id, "PHOTOGRAPHER", "USER", ben.id);
      expect(res.status).toBe(201);
      expect(res.body.count).toBe(1);
    });

    it("accepts a lowercase craft", async () => {
      const res = await recommend(ben, ana.id, "dj", "USER", ben.id);
      expect(res.status).toBe(201);
      expect(res.body.count).toBe(1);
    });

    it("recommends as a band you are a member of", async () => {
      const res = await recommend(cara, ana.id, "PHOTOGRAPHER", "BAND", bandId);
      expect(res.status).toBe(201);
      expect(res.body.count).toBe(2);
    });

    it("recommends as a venue you represent", async () => {
      const res = await recommend(cara, ana.id, "PHOTOGRAPHER", "VENUE", venueId);
      expect(res.status).toBe(201);
      expect(res.body.count).toBe(3);
    });

    it("403s when acting as a profile you cannot act as", async () => {
      const res = await recommend(ben, ana.id, "PHOTOGRAPHER", "BAND", bandId);
      expect(res.status).toBe(403);
    });

    it("400s on an invalid craft", async () => {
      const res = await recommend(ben, ana.id, "ASTRONAUT", "USER", ben.id);
      expect(res.status).toBe(400);
    });

    it("400s on an invalid recommenderType", async () => {
      const res = await recommend(ben, ana.id, "PHOTOGRAPHER", "ADMIN", ben.id);
      expect(res.status).toBe(400);
    });

    it("400s when recommending yourself", async () => {
      const res = await recommend(ana, ana.id, "PHOTOGRAPHER", "USER", ana.id);
      expect(res.status).toBe(400);
    });

    it("404s for a craft the user does not list", async () => {
      const res = await recommend(ben, ana.id, "VIDEOGRAPHER", "USER", ben.id);
      expect(res.status).toBe(404);
    });

    it("404s for a user that does not exist", async () => {
      const res = await recommend(ben, "no-such-user", "PHOTOGRAPHER", "USER", ben.id);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /users/:id/recommendations", () => {
    it("returns a count per listed craft, in craft order", async () => {
      const res = await list(ben, ana.id);
      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => r.craft)).toEqual(["PHOTOGRAPHER", "DJ"]);
      expect(entry(res.body, "PHOTOGRAPHER").count).toBe(3);
      expect(entry(res.body, "DJ").count).toBe(1);
    });

    it("flags what the viewer has recommended", async () => {
      const res = await list(cara, ana.id, { viewerType: "BAND", viewerId: bandId });
      expect(entry(res.body, "PHOTOGRAPHER").recommendedByViewer).toBe(true);
      expect(entry(res.body, "DJ").recommendedByViewer).toBe(false);
    });

    it("never flags for a viewer the caller cannot act as", async () => {
      // ben has recommended PHOTOGRAPHER, but mallory-style probing as ben must not reveal it.
      const res = await list(cara, ana.id, { viewerType: "USER", viewerId: ben.id });
      expect(res.status).toBe(200);
      expect(res.body.every((r: any) => r.recommendedByViewer === false)).toBe(true);
    });

    it("404s for a user that does not exist", async () => {
      const res = await list(ben, "no-such-user");
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /users/:id/crafts/:craft/recommend", () => {
    it("removes your recommendation", async () => {
      const res = await unrecommend(ben, ana.id, "PHOTOGRAPHER", "USER", ben.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ recommended: false, count: 2 });
    });

    it("is idempotent", async () => {
      const res = await unrecommend(ben, ana.id, "PHOTOGRAPHER", "USER", ben.id);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    it("accepts the recommender in the query string", async () => {
      const res = await request(app)
        .delete(`/users/${ana.id}/crafts/PHOTOGRAPHER/recommend`)
        .query({ recommenderType: "VENUE", recommenderId: venueId })
        .set(auth(cara.token));
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });

    it("403s when acting as a profile you cannot act as", async () => {
      const res = await unrecommend(ben, ana.id, "PHOTOGRAPHER", "BAND", bandId);
      expect(res.status).toBe(403);
    });

    it("400s on an invalid craft", async () => {
      const res = await unrecommend(ben, ana.id, "ASTRONAUT", "USER", ben.id);
      expect(res.status).toBe(400);
    });
  });

  describe("when the user edits their crafts", () => {
    it("hides a removed craft and restores its count when re-added", async () => {
      await setCrafts(ana, [{ craft: "DJ" }]);
      let res = await list(ben, ana.id);
      expect(res.body.map((r: any) => r.craft)).toEqual(["DJ"]);

      await setCrafts(ana, [{ craft: "PHOTOGRAPHER" }, { craft: "DJ" }]);
      res = await list(ben, ana.id);
      expect(entry(res.body, "PHOTOGRAPHER").count).toBe(1); // cara's band
      expect(entry(res.body, "DJ").count).toBe(1);
    });
  });
});
