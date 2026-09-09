import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDatabase, registerUser, auth, setCrafts, TestUser } from "./helpers";

/**
 * User crafts and craft discovery -- the photographers, promoters and sound
 * engineers who make up a scene alongside its bands and venues.
 */
describe("crafts and people discovery", () => {
  let ana: TestUser;      // Houston photographer, for hire
  let pete: TestUser;     // Houston promoter, not for hire
  let dana: TestUser;     // Dallas photographer
  let plain: TestUser;    // no crafts at all
  let mallory: TestUser;  // unaffiliated

  beforeAll(async () => {
    await resetDatabase();

    ana = await registerUser({ username: "ana_people", name: "Ana Reyes", city: "Houston", state: "TX" });
    pete = await registerUser({ username: "pete_people", name: "Pete Ortiz", city: "Houston", state: "TX" });
    dana = await registerUser({ username: "dana_people", name: "Dana Cruz", city: "Dallas", state: "TX" });
    plain = await registerUser({ username: "plain_people", name: "Plain User", city: "Houston", state: "TX" });
    mallory = await registerUser({ username: "mallory_people", name: "Mallory", city: "Houston", state: "TX" });

    await setCrafts(ana, [
      { craft: "PHOTOGRAPHER", forHire: true, headline: "Live show photography" },
    ]);
    await setCrafts(pete, [{ craft: "PROMOTER", forHire: false }]);
    await setCrafts(dana, [{ craft: "PHOTOGRAPHER", forHire: true }]);
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe("PUT /users/:id/crafts", () => {
    it("401s without a token", async () => {
      const res = await request(app)
        .put(`/users/${ana.id}/crafts`)
        .send({ crafts: [{ craft: "PHOTOGRAPHER" }] });
      expect(res.status).toBe(401);
    });

    it("sets crafts on yourself by id", async () => {
      const res = await request(app)
        .put(`/users/${ana.id}/crafts`)
        .set(auth(ana.token))
        .send({
          crafts: [
            { craft: "PHOTOGRAPHER", forHire: true, headline: "Live show photography" },
            { craft: "VIDEOGRAPHER", forHire: false },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.crafts.map((c: any) => c.craft)).toEqual([
        "PHOTOGRAPHER",
        "VIDEOGRAPHER",
      ]);
      expect(await prisma.userCraft.count({ where: { userId: ana.id } })).toBe(2);
    });

    it("accepts 'me' as an alias for yourself", async () => {
      const res = await request(app)
        .put("/users/me/crafts")
        .set(auth(pete.token))
        .send({ crafts: [{ craft: "PROMOTER", forHire: false }] });

      expect(res.status).toBe(200);
      expect(res.body.crafts).toHaveLength(1);
    });

    it("removes dropped crafts when given a shorter array", async () => {
      // Replacing the set is the "undo" operation.
      await setCrafts(ana, [
        { craft: "PHOTOGRAPHER", forHire: true },
        { craft: "VIDEOGRAPHER" },
      ]);
      expect(await prisma.userCraft.count({ where: { userId: ana.id } })).toBe(2);

      const remaining = await setCrafts(ana, [{ craft: "PHOTOGRAPHER", forHire: true }]);
      expect(remaining.map(c => c.craft)).toEqual(["PHOTOGRAPHER"]);
      expect(await prisma.userCraft.count({ where: { userId: ana.id } })).toBe(1);
    });

    it("clears every craft when given an empty array", async () => {
      await setCrafts(plain, [{ craft: "BOOKER" }]);
      await setCrafts(plain, []);
      expect(await prisma.userCraft.count({ where: { userId: plain.id } })).toBe(0);
    });

    it("preserves forHire and headline", async () => {
      const crafts = await setCrafts(ana, [
        { craft: "PHOTOGRAPHER", forHire: true, headline: "Live show photography" },
      ]);
      expect(crafts[0]).toMatchObject({
        craft: "PHOTOGRAPHER",
        forHire: true,
        headline: "Live show photography",
      });
    });

    describe("validation", () => {
      const put = (user: TestUser, body: any) =>
        request(app).put("/users/me/crafts").set(auth(user.token)).send(body);

      it("400s on a non-array", async () => {
        expect((await put(mallory, { crafts: "PHOTOGRAPHER" })).status).toBe(400);
        expect((await put(mallory, {})).status).toBe(400);
      });

      it("400s on an unknown craft", async () => {
        expect((await put(mallory, { crafts: [{ craft: "WIZARD" }] })).status).toBe(400);
      });

      it("400s on more than six crafts", async () => {
        const seven = [
          "PHOTOGRAPHER", "VIDEOGRAPHER", "PROMOTER", "SOUND_ENGINEER",
          "BOOKER", "DESIGNER", "MERCH",
        ].map(craft => ({ craft }));
        expect((await put(mallory, { crafts: seven })).status).toBe(400);
      });

      it("400s on duplicate crafts", async () => {
        const res = await put(mallory, {
          crafts: [{ craft: "PHOTOGRAPHER" }, { craft: "PHOTOGRAPHER" }],
        });
        expect(res.status).toBe(400);
      });

      it("400s on an over-long headline", async () => {
        const res = await put(mallory, {
          crafts: [{ craft: "PHOTOGRAPHER", headline: "x".repeat(121) }],
        });
        expect(res.status).toBe(400);
      });

      it("writes nothing when validation fails", async () => {
        await setCrafts(mallory, [{ craft: "BOOKER" }]);
        await put(mallory, { crafts: [{ craft: "WIZARD" }] });

        const rows = await prisma.userCraft.findMany({ where: { userId: mallory.id } });
        expect(rows.map(r => r.craft)).toEqual(["BOOKER"]);

        await setCrafts(mallory, []);
      });
    });

    describe("refusals", () => {
      it("refuses to set another user's crafts", async () => {
        const res = await request(app)
          .put(`/users/${ana.id}/crafts`)
          .set(auth(mallory.token))
          .send({ crafts: [{ craft: "MERCH" }] });

        expect(res.status).toBe(403);

        const rows = await prisma.userCraft.findMany({ where: { userId: ana.id } });
        expect(rows.map(r => r.craft)).toEqual(["PHOTOGRAPHER"]);
      });

      it("refuses to REMOVE another user's crafts", async () => {
        // Sending a shorter array is how you delete, so the destructive direction
        // needs its own test -- a missing inverse check is the bug class
        // CONTRIBUTING singles out.
        const before = await prisma.userCraft.findMany({ where: { userId: ana.id } });
        expect(before.length).toBeGreaterThan(0);

        const res = await request(app)
          .put(`/users/${ana.id}/crafts`)
          .set(auth(mallory.token))
          .send({ crafts: [] });

        expect(res.status).toBe(403);

        const after = await prisma.userCraft.findMany({ where: { userId: ana.id } });
        expect(after).toHaveLength(before.length);
      });
    });
  });

  describe("GET /users/discover", () => {
    it("401s without a token", async () => {
      expect((await request(app).get("/users/discover")).status).toBe(401);
    });

    it("returns only people who have declared a craft", async () => {
      const res = await request(app).get("/users/discover").set(auth(mallory.token));
      expect(res.status).toBe(200);

      const usernames = res.body.people.map((p: any) => p.username);
      expect(usernames).toContain("ana_people");
      expect(usernames).not.toContain("plain_people");
    });

    it("filters by craft", async () => {
      const res = await request(app)
        .get("/users/discover?craft=PROMOTER")
        .set(auth(mallory.token));

      expect(res.body.people.map((p: any) => p.username)).toEqual(["pete_people"]);
    });

    it("filters by forHire", async () => {
      const res = await request(app)
        .get("/users/discover?craft=PHOTOGRAPHER&forHire=true")
        .set(auth(mallory.token));

      const usernames = res.body.people.map((p: any) => p.username).sort();
      expect(usernames).toEqual(["ana_people", "dana_people"]);
    });

    it("filters by city", async () => {
      const res = await request(app)
        .get("/users/discover?craft=PHOTOGRAPHER&city=Houston&state=TX")
        .set(auth(mallory.token));

      expect(res.body.people.map((p: any) => p.username)).toEqual(["ana_people"]);
    });

    it("filters by sceneSlug", async () => {
      const res = await request(app)
        .get("/users/discover?sceneSlug=houston-tx")
        .set(auth(mallory.token));

      const usernames = res.body.people.map((p: any) => p.username).sort();
      expect(usernames).toEqual(["ana_people", "pete_people"]);
    });

    it("returns an empty list for an unknown scene rather than 404", async () => {
      const res = await request(app)
        .get("/users/discover?sceneSlug=nowhere-zz")
        .set(auth(mallory.token));

      expect(res.status).toBe(200);
      expect(res.body.people).toEqual([]);
    });

    it("searches by name and username", async () => {
      const byName = await request(app).get("/users/discover?q=Reyes").set(auth(mallory.token));
      expect(byName.body.people.map((p: any) => p.username)).toEqual(["ana_people"]);

      const byUsername = await request(app).get("/users/discover?q=pete_").set(auth(mallory.token));
      expect(byUsername.body.people.map((p: any) => p.username)).toEqual(["pete_people"]);
    });

    it("400s on an unknown craft", async () => {
      const res = await request(app)
        .get("/users/discover?craft=NOPE")
        .set(auth(mallory.token));
      expect(res.status).toBe(400);
    });

    it("clamps an oversized limit", async () => {
      const res = await request(app)
        .get("/users/discover?limit=99999")
        .set(auth(mallory.token));
      expect(res.body.limit).toBe(100);
    });

    it("carries crafts and a readable subtitle", async () => {
      const res = await request(app)
        .get("/users/discover?craft=PHOTOGRAPHER&city=Houston")
        .set(auth(mallory.token));

      const person = res.body.people[0];
      expect(person.crafts[0]).toMatchObject({ craft: "PHOTOGRAPHER", forHire: true });
      expect(person.subtitle).toBe("Photographer · For hire");
    });

    it("renders multi-word crafts readably", async () => {
      await setCrafts(pete, [{ craft: "SOUND_ENGINEER", forHire: false }]);

      const res = await request(app)
        .get("/users/discover?craft=SOUND_ENGINEER")
        .set(auth(mallory.token));

      expect(res.body.people[0].subtitle).toBe("Sound Engineer");

      await setCrafts(pete, [{ craft: "PROMOTER", forHire: false }]);
    });

    it("never exposes a password or email", async () => {
      const res = await request(app).get("/users/discover").set(auth(mallory.token));

      const body = JSON.stringify(res.body);
      expect(body).not.toContain("password");
      expect(body).not.toContain("@test.com");
      for (const person of res.body.people) {
        expect(person).not.toHaveProperty("password");
        expect(person).not.toHaveProperty("email");
      }
    });

    it("is not swallowed by the parameterised user getters", async () => {
      // Route-order regression: /users/discover must not be read as a username.
      const res = await request(app).get("/users/discover").set(auth(mallory.token));
      expect(res.body).toHaveProperty("people");
    });
  });

  describe("crafts on user profiles", () => {
    it("appear on GET /users/id/:id", async () => {
      const res = await request(app).get(`/users/id/${ana.id}`).set(auth(mallory.token));
      expect(res.status).toBe(200);
      expect(res.body.crafts.map((c: any) => c.craft)).toEqual(["PHOTOGRAPHER"]);
    });

    it("appear on GET /users/username/:username", async () => {
      const res = await request(app).get("/users/username/ana_people").set(auth(mallory.token));
      expect(res.body.crafts[0]).toMatchObject({ craft: "PHOTOGRAPHER" });
    });

    it("no longer expose the dead isPromoter flag", async () => {
      const res = await request(app).get(`/users/id/${ana.id}`).set(auth(mallory.token));
      expect(res.body).not.toHaveProperty("isPromoter");
    });
  });
});
