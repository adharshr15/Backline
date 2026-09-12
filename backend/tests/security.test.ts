import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDatabase, registerUser, auth, createBand, createVenue, futureDate, TestUser } from "./helpers";

/**
 * Regression tests for the authorization and disclosure defects found in the
 * September 2026 security review. Each test fails against the pre-fix code.
 *
 * The shape of nearly every bug was the same: an endpoint trusted a caller-supplied
 * profile id (`senderId`, `followerId`, `reposterBandId`, …) without checking that
 * the authenticated user may act as that profile.
 */

let alice: TestUser;   // owns aliceBand + aliceVenue
let mallory: TestUser; // unaffiliated attacker
let aliceBand: string;
let aliceVenue: string;

beforeAll(async () => {
  await resetDatabase();
  alice = await registerUser({ username: "alice_sec", name: "Alice" });
  mallory = await registerUser({ username: "mallory_sec", name: "Mallory" });
  aliceBand = await createBand(alice, "Alice Band");
  aliceVenue = await createVenue(alice, "Alice Venue");
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe("authentication", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed Authorization header", async () => {
    const res = await request(app).get("/auth/me").set({ Authorization: "some-token" });
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = jwt.sign({ userId: alice.id }, "not-the-real-secret");
    const res = await request(app).get("/auth/me").set(auth(forged));
    expect(res.status).toBe(401);
  });

  it("rejects a well-formed token that carries no userId", async () => {
    const empty = jwt.sign({ notAUserId: true }, process.env.JWT_SECRET as string);
    const res = await request(app).get("/auth/me").set(auth(empty));
    expect(res.status).toBe(401);
  });

  it("accepts a genuine token", async () => {
    const res = await request(app).get("/auth/me").set(auth(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(alice.id);
  });
});

describe("profile impersonation", () => {
  it("refuses to open a conversation as another user", async () => {
    const res = await request(app)
      .post("/conversations")
      .set(auth(mallory.token))
      .send({
        senderType: "USER",
        senderId: alice.id,     // not mallory
        userIds: [mallory.id],
        content: "sent as Alice",
      });

    expect(res.status).toBe(403);

    // and nothing was written
    const messages = await prisma.message.findMany({ where: { senderUserId: alice.id } });
    expect(messages).toHaveLength(0);
  });

  it("refuses to open a conversation as a band the caller is not in", async () => {
    const res = await request(app)
      .post("/conversations")
      .set(auth(mallory.token))
      .send({ senderType: "BAND", senderId: aliceBand, userIds: [mallory.id], content: "hi" });

    expect(res.status).toBe(403);
  });

  it("refuses to post as a band the caller is not in", async () => {
    const res = await request(app)
      .post("/posts")
      .set(auth(mallory.token))
      .field("ownerType", "BAND")
      .field("ownerId", aliceBand)
      .attach("media", Buffer.from("fake"), { filename: "x.png", contentType: "image/png" });

    expect(res.status).toBe(403);
  });

  it("refuses to page Explore posts as a band the caller is not in", async () => {
    // The ranking reads the band's follow graph and genres; paging as it would leak both.
    const res = await request(app)
      .get(`/explore/posts?profileType=band&profileId=${aliceBand}`)
      .set(auth(mallory.token));

    expect(res.status).toBe(403);
  });
});

describe("conversation read receipts", () => {
  let conversationId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/conversations")
      .set(auth(alice.token))
      .send({ senderType: "USER", senderId: alice.id, userIds: [mallory.id], content: "hello" });
    conversationId = res.body.id;
  });

  it("refuses to mark a conversation read on another user's behalf", async () => {
    const res = await request(app)
      .post(`/conversations/${conversationId}/read`)
      .set(auth(mallory.token))
      .send({ senderType: "USER", senderId: alice.id });

    expect(res.status).toBe(403);
  });

  it("rejects an unknown senderType instead of marking every participant read", async () => {
    const before = await prisma.conversationParticipant.findMany({ where: { conversationId } });

    const res = await request(app)
      .post(`/conversations/${conversationId}/read`)
      .set(auth(mallory.token))
      .send({ senderType: "NOT_A_TYPE", senderId: alice.id });

    expect(res.status).toBe(400);

    const after = await prisma.conversationParticipant.findMany({ where: { conversationId } });
    expect(after.map(p => p.lastReadAt?.toISOString()))
      .toEqual(before.map(p => p.lastReadAt?.toISOString()));
  });
});

describe("band authorization", () => {
  it("refuses to edit a band the caller is not a member of", async () => {
    const res = await request(app)
      .put(`/bands/${aliceBand}`)
      .set(auth(mallory.token))
      .send({ name: "Owned By Mallory", bio: "defaced" });

    expect(res.status).toBe(403);

    const band = await prisma.band.findUnique({ where: { id: aliceBand } });
    expect(band?.name).toBe("Alice Band");
  });

  it("lets a plain MEMBER edit band details but not the roster", async () => {
    const bob = await registerUser({ username: "bob_sec" });

    // Alice invites Bob; Bob accepts -> Bob is a MEMBER, not a MANAGER.
    await request(app).put(`/bands/${aliceBand}`).set(auth(alice.token))
      .send({ inviteMemberId: bob.id });

    const invite = await prisma.bandInvite.findFirst({ where: { bandId: aliceBand, userId: bob.id } });
    await request(app)
      .post(`/membership-invites/band/${invite!.id}/respond`)
      .set(auth(bob.token))
      .send({ userId: bob.id, action: "ACCEPT" });

    // Editing details: allowed.
    const edit = await request(app).put(`/bands/${aliceBand}`).set(auth(bob.token))
      .send({ bio: "bio from a member" });
    expect(edit.status).toBe(200);

    // Removing the manager: refused. Previously `isManager` also accepted MEMBER,
    // so any member could evict the manager and promote themselves.
    const evict = await request(app).put(`/bands/${aliceBand}`).set(auth(bob.token))
      .send({ removeMemberId: alice.id });
    expect(evict.status).toBe(403);

    const promote = await request(app).put(`/bands/${aliceBand}`).set(auth(bob.token))
      .send({ updateRole: { userId: bob.id, bandRole: "MANAGER" } });
    expect(promote.status).toBe(403);

    const stillManager = await prisma.bandMember.findFirst({
      where: { bandId: aliceBand, userId: alice.id },
    });
    expect(stillManager?.role).toBe("MANAGER");
  });
});

describe("venue authorization", () => {
  it("refuses to edit a venue the caller does not represent", async () => {
    const res = await request(app)
      .put(`/venues/${aliceVenue}`)
      .set(auth(mallory.token))
      .send({ name: "Mallory's Venue" });

    expect(res.status).toBe(403);
  });
});

describe("tour authorization", () => {
  let tourId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/tours")
      .set(auth(alice.token))
      .send({ name: "Alice Tour", creatorBandId: aliceBand, bandIds: [] });
    tourId = res.body.id;
  });

  it("refuses to delete a tour the caller does not manage", async () => {
    const res = await request(app).delete(`/tours/${tourId}`).set(auth(mallory.token));

    expect(res.status).toBe(403);

    const tour = await prisma.tour.findUnique({ where: { id: tourId } });
    expect(tour?.deletedAt).toBeNull();
  });

  it("lets the creator band delete its own tour", async () => {
    const res = await request(app).delete(`/tours/${tourId}`).set(auth(alice.token));
    expect(res.status).toBe(200);
  });
});

describe("follows", () => {
  it("refuses to unfollow on behalf of a band the caller is not in", async () => {
    const target = await createBand(alice, "Target Band");

    await request(app).post("/follows").set(auth(alice.token)).send({
      followerType: "BAND", followerBandId: aliceBand,
      followeeType: "BAND", followeeId: target,
    });

    const res = await request(app).delete("/follows").set(auth(mallory.token)).send({
      followerType: "BAND", followerBandId: aliceBand,
      followeeType: "BAND", followeeId: target,
    });

    expect(res.status).toBe(403);

    const stillFollowing = await prisma.follow.findFirst({
      where: { followerBandId: aliceBand, followeeBandId: target },
    });
    expect(stillFollowing).not.toBeNull();
  });
});

describe("scene follows", () => {
  it("refuses to follow a scene as another profile", async () => {
    const res = await request(app).post("/scenes/follow").set(auth(mallory.token))
      .send({ city: "Austin", state: "TX", followerId: aliceBand, followerType: "band" });

    expect(res.status).toBe(403);
  });

  it("refuses to unfollow a scene as another profile", async () => {
    await request(app).post("/scenes/follow").set(auth(alice.token))
      .send({ city: "Austin", state: "TX", followerId: aliceBand, followerType: "band" });

    const res = await request(app).delete("/scenes/follow").set(auth(mallory.token))
      .send({ city: "Austin", state: "TX", followerId: aliceBand, followerType: "band" });

    expect(res.status).toBe(403);

    const stillThere = await prisma.sceneFollow.findFirst({
      // Through the relation: SceneFollow no longer has its own city column.
      where: { followerId: aliceBand, followerType: "band", scene: { city: "Austin" } },
    });
    expect(stillThere).not.toBeNull();
  });

  // The endpoint now also accepts { sceneId } and { slug }. Each identification
  // form is its own way in, so each is checked separately.
  it("refuses to follow by sceneId as another profile", async () => {
    const scene = await prisma.scene.findFirstOrThrow({ where: { city: "Austin" } });

    const res = await request(app).post("/scenes/follow").set(auth(mallory.token))
      .send({ sceneId: scene.id, followerId: aliceBand, followerType: "band" });

    expect(res.status).toBe(403);
  });

  it("refuses to unfollow by slug as another profile, and the follow survives", async () => {
    const scene = await prisma.scene.findFirstOrThrow({ where: { city: "Austin" } });

    await request(app).post("/scenes/follow").set(auth(alice.token))
      .send({ sceneId: scene.id, followerId: aliceBand, followerType: "band" });

    const res = await request(app).delete("/scenes/follow").set(auth(mallory.token))
      .send({ slug: scene.slug, followerId: aliceBand, followerType: "band" });

    expect(res.status).toBe(403);

    const stillThere = await prisma.sceneFollow.findFirst({
      where: { followerId: aliceBand, followerType: "band", sceneId: scene.id },
    });
    expect(stillThere).not.toBeNull();
  });

  it("does not create a scene as a side effect of a refused follow", async () => {
    // Authorization runs before resolution, so a caller who may not act as the
    // profile cannot use this endpoint to mint scene rows either.
    const res = await request(app).post("/scenes/follow").set(auth(mallory.token))
      .send({ city: "Galveston", state: "TX", followerId: aliceBand, followerType: "band" });

    expect(res.status).toBe(403);
    expect(await prisma.scene.findUnique({ where: { slug: "galveston-tx" } })).toBeNull();
  });
});

describe("show feed", () => {
  // GET /shows/feed was mounted above router.use(authenticate) and took
  // followerId straight from the query string, so anyone could read any
  // profile's personalized feed -- and with it, that profile's entire follow
  // graph -- by guessing a cuid.
  it("requires authentication", async () => {
    const res = await request(app).get(`/shows/feed?followerType=user&followerId=${alice.id}`);
    expect(res.status).toBe(401);
  });

  it("refuses to read another user's feed", async () => {
    const res = await request(app)
      .get(`/shows/feed?followerType=user&followerId=${alice.id}`)
      .set(auth(mallory.token));

    expect(res.status).toBe(403);
  });

  it("refuses to read a band's feed without membership", async () => {
    const res = await request(app)
      .get(`/shows/feed?followerType=band&followerId=${aliceBand}`)
      .set(auth(mallory.token));

    expect(res.status).toBe(403);
  });

  it("refuses to read a venue's feed without representation", async () => {
    const res = await request(app)
      .get(`/shows/feed?followerType=venue&followerId=${aliceVenue}`)
      .set(auth(mallory.token));

    expect(res.status).toBe(403);
  });
});

describe("explore feed", () => {
  it("refuses to browse as another profile", async () => {
    const res = await request(app)
      .get(`/explore?profileType=venue&profileId=${aliceVenue}`)
      .set(auth(mallory.token));

    expect(res.status).toBe(403);
  });
});

describe("user crafts", () => {
  it("refuses to set another user's crafts", async () => {
    const res = await request(app).put(`/users/${alice.id}/crafts`).set(auth(mallory.token))
      .send({ crafts: [{ craft: "PROMOTER" }] });

    expect(res.status).toBe(403);
    expect(await prisma.userCraft.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("refuses to clear another user's crafts", async () => {
    // An empty array is the delete operation, so the inverse needs its own check.
    await request(app).put("/users/me/crafts").set(auth(alice.token))
      .send({ crafts: [{ craft: "PHOTOGRAPHER", forHire: true }] });

    const res = await request(app).put(`/users/${alice.id}/crafts`).set(auth(mallory.token))
      .send({ crafts: [] });

    expect(res.status).toBe(403);
    expect(await prisma.userCraft.count({ where: { userId: alice.id } })).toBe(1);
  });
});

describe("show RSVP and repost", () => {
  let showId: string;

  beforeAll(async () => {
    const res = await request(app).post("/shows").set(auth(alice.token)).send({
      date: futureDate(),
      doors: futureDate(),
      city: "Austin", state: "TX", country: "USA",
      creatorBandId: aliceBand,
    });
    showId = res.body.id;

    await request(app).post(`/shows/${showId}/rsvp`).set(auth(alice.token))
      .send({ rsvpType: "band", rsvpBandId: aliceBand });
    await request(app).post(`/shows/${showId}/repost`).set(auth(alice.token))
      .send({ reposterType: "band", reposterBandId: aliceBand });
  });

  it("refuses to cancel another band's RSVP", async () => {
    const res = await request(app).delete(`/shows/${showId}/rsvp`).set(auth(mallory.token))
      .send({ rsvpType: "band", rsvpBandId: aliceBand });

    expect(res.status).toBe(403);

    const show = await prisma.show.findUnique({
      where: { id: showId }, include: { rsvpBands: { select: { id: true } } },
    });
    expect(show?.rsvpBands.map(b => b.id)).toContain(aliceBand);
  });

  it("refuses to remove another band's repost", async () => {
    const res = await request(app).delete(`/shows/${showId}/repost`).set(auth(mallory.token))
      .send({ reposterType: "band", reposterBandId: aliceBand });

    expect(res.status).toBe(403);

    const show = await prisma.show.findUnique({
      where: { id: showId }, include: { repostedByBands: { select: { id: true } } },
    });
    expect(show?.repostedByBands.map(b => b.id)).toContain(aliceBand);
  });
});

describe("information disclosure", () => {
  it("does not return email addresses from the user directory", async () => {
    const res = await request(app).get("/users").set(auth(mallory.token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const user of res.body) {
      expect(user.email).toBeUndefined();
      expect(user.password).toBeUndefined();
    }
  });

  it("caps an oversized page size", async () => {
    const res = await request(app).get("/users?limit=100000").set(auth(mallory.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(100);
  });

  it("does not expose another user's email or password hash", async () => {
    const res = await request(app).get(`/users/id/${alice.id}`).set(auth(mallory.token));

    expect(res.status).toBe(200);
    expect(res.body.email).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });

  it("returns the caller's own email on their own record", async () => {
    const res = await request(app).get(`/users/id/${alice.id}`).set(auth(alice.token));
    expect(res.body.email).toBe(alice.email);
    expect(res.body.password).toBeUndefined();
  });

  it("does not leak internal error detail on a bad login", async () => {
    const res = await request(app).post("/auth/login").send({ email: "nobody@test.com" });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|postgres|invocation|\.ts:/i);
  });

  it("answers a wrong password and an unknown account identically", async () => {
    const unknown = await request(app).post("/auth/login")
      .send({ email: "nobody@test.com", password: "password123" });
    const wrongPassword = await request(app).post("/auth/login")
      .send({ email: alice.email, password: "wrong-password" });

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body).toEqual(wrongPassword.body);
  });
});

describe("password handling", () => {
  it("rejects a password shorter than the minimum at registration", async () => {
    const res = await request(app).post("/auth/register").send({
      name: "Shorty", username: "shorty_sec", email: "shorty@test.com",
      password: "short", city: "Austin", state: "TX", country: "USA",
    });

    expect(res.status).toBe(400);
  });

  it("requires the current password to set a new one", async () => {
    const victim = await registerUser({ username: "victim_sec" });

    const res = await request(app).put("/users/me").set(auth(victim.token))
      .send({ password: "attacker-chosen-password" });

    expect(res.status).toBe(403);

    // the original password still works
    const login = await request(app).post("/auth/login")
      .send({ email: victim.email, password: victim.password });
    expect(login.status).toBe(200);
  });

  it("changes the password when the current one is supplied", async () => {
    const user = await registerUser({ username: "rotator_sec" });

    const res = await request(app).put("/users/me").set(auth(user.token))
      .send({ currentPassword: user.password, password: "a-brand-new-password" });
    expect(res.status).toBe(200);

    const login = await request(app).post("/auth/login")
      .send({ email: user.email, password: "a-brand-new-password" });
    expect(login.status).toBe(200);
  });

  it("never returns a password hash from register or login", async () => {
    const reg = await request(app).post("/auth/register").send({
      name: "Fresh", username: "fresh_sec", email: "fresh@test.com",
      password: "password123", city: "Austin", state: "TX", country: "USA",
    });
    expect(reg.body.user.password).toBeUndefined();

    const login = await request(app).post("/auth/login")
      .send({ email: "fresh@test.com", password: "password123" });
    expect(login.body.user.password).toBeUndefined();
  });
});

describe("file uploads", () => {
  it("rejects a scriptable payload disguised with an image content-type", async () => {
    const res = await request(app)
      .post("/posts")
      .set(auth(alice.token))
      .field("ownerType", "USER")
      .field("ownerId", alice.id)
      .attach("media", Buffer.from("<script>alert(document.domain)</script>"), {
        filename: "payload.html",
        contentType: "image/png", // client-declared, and previously believed
      });

    expect(res.status).toBe(400);
  });

  it("rejects an SVG, which is scriptable in a browser", async () => {
    const res = await request(app)
      .post("/posts")
      .set(auth(alice.token))
      .field("ownerType", "USER")
      .field("ownerId", alice.id)
      .attach("media", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"), {
        filename: "payload.svg",
        contentType: "image/svg+xml",
      });

    expect(res.status).toBe(400);
  });

  it("accepts a genuine image and stores it under a generated name", async () => {
    const res = await request(app)
      .post("/posts")
      .set(auth(alice.token))
      .field("ownerType", "USER")
      .field("ownerId", alice.id)
      .attach("media", Buffer.from("not-really-a-png-but-the-extension-is-allowed"), {
        filename: "holiday snap.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(201);
    // The stored name must not echo the client's filename.
    expect(res.body.url).toMatch(/^\/uploads\/\d+-[0-9a-f]{24}\.png$/);
    expect(res.body.url).not.toContain("holiday");
  });

  it("serves uploads with sniffing disabled", async () => {
    const created = await request(app)
      .post("/posts")
      .set(auth(alice.token))
      .field("ownerType", "USER")
      .field("ownerId", alice.id)
      .attach("media", Buffer.from("image-bytes"), {
        filename: "a.png", contentType: "image/png",
      });

    const res = await request(app).get(created.body.url);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
  });

  it("does not serve files outside the uploads directory", async () => {
    for (const attempt of ["..%2F.env", "..%5C.env", "%2e%2e%2f.env", "../.env"]) {
      const res = await request(app).get(`/uploads/${attempt}`);
      expect(res.status).not.toBe(200);
    }
  });
});

describe("input validation", () => {
  it("answers a malformed show date with 400, not 500", async () => {
    const res = await request(app).post("/shows").set(auth(alice.token)).send({
      date: "not-a-date", doors: futureDate(),
      city: "Austin", state: "TX", country: "USA",
      creatorBandId: aliceBand,
    });

    expect(res.status).toBe(400);
  });

  it("answers a missing doors time with 400, not 500", async () => {
    const res = await request(app).post("/shows").set(auth(alice.token)).send({
      date: futureDate(),
      city: "Austin", state: "TX", country: "USA",
      creatorBandId: aliceBand,
    });

    expect(res.status).toBe(400);
  });

  it("answers an unknown route with a JSON 404", async () => {
    const res = await request(app).get("/no-such-route");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
