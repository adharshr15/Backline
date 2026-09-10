import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetDatabase, registerUser, createBand, createVenue, TestUser } from "./helpers";

/**
 * GET /bands/:id and GET /venues/:id are public -- both are mounted before
 * router.use(authenticate) -- and embedded each member's or representative's
 * whole User row via `include: { user: true }`. Anyone, with no token, could read
 * the email address and bcrypt password hash of every account behind a band or
 * venue.
 */
describe("public profile endpoints do not leak member accounts", () => {
  let owner: TestUser;
  let bandId: string;
  let venueId: string;

  beforeAll(async () => {
    await resetDatabase();
    owner = await registerUser({ username: "exposure_owner" });
    bandId = await createBand(owner, "Exposure Band");
    venueId = await createVenue(owner, "Exposure Venue");
  });

  it("GET /bands/:id returns members without password or email", async () => {
    const res = await request(app).get(`/bands/${bandId}`);

    expect(res.status).toBe(200);
    const user = res.body.members[0].user;
    expect(user).toMatchObject({ id: owner.id, username: owner.username });
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("email");
    expect(JSON.stringify(res.body)).not.toContain("$2b$");
  });

  it("GET /venues/:id returns representatives without password or email", async () => {
    const res = await request(app).get(`/venues/${venueId}`);

    expect(res.status).toBe(200);
    const user = res.body.representatives[0].user;
    expect(user).toMatchObject({ id: owner.id, username: owner.username });
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("email");
    expect(JSON.stringify(res.body)).not.toContain("$2b$");
  });
});
