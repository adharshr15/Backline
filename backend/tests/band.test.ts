import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/app"
import { prisma } from "../src/lib/prisma"

let testBandId: string
let creatorId: string
let creatorToken: string
let inviteeId1: string
let invitee1Token: string
let inviteeId2: string
let invitee2Token: string
let testTourId: string
let testShowId: string

beforeAll(async () => {
    // Clean test database in correct order
    await prisma.show.deleteMany()
    await prisma.tour.deleteMany()
    await prisma.conversationParticipant.deleteMany()
    await prisma.message.deleteMany()
    await prisma.bandMember.deleteMany()
    await prisma.venueRepresentative.deleteMany()
    await prisma.bandInvite.deleteMany()
    await prisma.venueInvite.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.band.deleteMany()
    await prisma.venue.deleteMany()

    // Create test users
    const creatorRes = await request(app)
        .post("/auth/register")
        .send({
            name: "Creator User",
            username: "creator",
            email: "creator@test.com",
            password: "password", city: "Austin", state: "TX", country: "USA",
        });

    creatorId = creatorRes.body.user.id;
    creatorToken = creatorRes.body.token;

    // Create invitee users
    const invitee1 = await request(app)
        .post("/auth/register")
        .send({
            name: "Invitee 1",
            username: "invitee1",
            email: "invitee1@test.com",
            password: "password", city: "Austin", state: "TX", country: "USA",
        });
    inviteeId1 = invitee1.body.user.id;
    invitee1Token = invitee1.body.token;

    const invitee2 = await request(app)
        .post("/auth/register")
        .send({
            name: "Invitee 2",
            username: "invitee2",
            email: "invitee2@test.com",
            password: "password", city: "Austin", state: "TX", country: "USA",
        });
    inviteeId2 = invitee2.body.user.id;
    invitee2Token = invitee2.body.token;


    // Create test tour
    const tour1 = await prisma.tour.create({
        data: {
            name: "Winter 2026"
        }
    });
    testTourId = tour1.id;
    console.log('testTourId: ', testTourId);

    // `doors` is a required DateTime, and createdByBandId is a real FK — a literal
    // "test" string here made the whole suite fail before any assertion ran.
    const show1 = await prisma.show.create({
        data: {
            date: new Date(Date.now() + 30 * 86_400_000),
            doors: new Date(Date.now() + 30 * 86_400_000 + 19 * 3_600_000),
            city: "Austin",
            state: "Texas",
            country: "United States",
        }
    })
    testShowId = show1.id;

})

afterAll(async () => {
    // Cleanup DB completely after all tests
    await prisma.show.deleteMany()
    await prisma.tour.deleteMany()
    await prisma.conversationParticipant.deleteMany()
    await prisma.message.deleteMany()
    await prisma.bandMember.deleteMany()
    await prisma.venueRepresentative.deleteMany()
    await prisma.bandInvite.deleteMany()
    await prisma.venueInvite.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.band.deleteMany()
    await prisma.venue.deleteMany()
})

describe("Band API", () => {

    // CREATE
    it("Should create a band", async () => {
        const res = await request(app)
            .post("/bands")
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                name: "Heel",
                city: "College Station",
                state: "Texas",
                country: "USA",
                members: [{ userId: inviteeId1 }, { userId: inviteeId2 }],
            });

        expect(res.status).toBe(201);
        testBandId = res.body.id;
        expect(testBandId).toBeDefined();

        // Creator should be a member
        const memberIds = res.body.members.map((m: any) => m.userId);
        expect(memberIds).toContain(creatorId);

        // Invites should exist for invitees
        const invites = await prisma.bandInvite.findMany({ where: { bandId: testBandId } });
        const inviteeIds = invites.map((i) => i.userId);
        expect(inviteeIds).toContain(inviteeId1);
        expect(inviteeIds).toContain(inviteeId2);
    })
    it("Should allow invitees to accept invitation requests", async () => {
        // Fetch the invites from DB
        const invites = await prisma.bandInvite.findMany({ where: { bandId: testBandId } });

        // Find the invite IDs for each invitee
        const invite1 = invites.find(i => i.userId === inviteeId1);
        const invite2 = invites.find(i => i.userId === inviteeId2);

        expect(invite1).toBeDefined();
        expect(invite2).toBeDefined();

        // Accept invitee1
        let res = await request(app)
            .post(`/users/band-invites/${invite1!.id}/respond`) // Use invite ID
            .set("Authorization", `Bearer ${invitee1Token}`)
            .send({ action: "ACCEPT" });

        expect(res.status).toBe(200);
        expect(res.body.members.map((m: any) => m.userId)).toContain(inviteeId1);

        // Decline invitee2
        res = await request(app)
            .post(`/users/band-invites/${invite2!.id}/respond`) // Use invite ID
            .set("Authorization", `Bearer ${invitee2Token}`)
            .send({ action: "DECLINE" });

        expect(res.status).toBe(200);

        // Ensure invitee2 is NOT a member
        const band = await prisma.band.findUnique({
            where: { id: testBandId },
            include: { members: true, invites: true },
        });

        const memberIds = band?.members.map((m) => m.userId);
        expect(memberIds).not.toContain(inviteeId2);
    });
    it("Should fail to create a band without auth", async () => {
        const res = await request(app).post("/bands").send({ name: "NoAuth" });
        expect(res.status).toBe(401);
    });

    // READ
    it("Should get all bands", async () => {
        const res = await request(app)
            .get("/bands")
        expect(res.status).toBe(200)
        console.log(res.body)
    })
    it("Should get a valid band", async () => {
        const res = await request(app)
            .get(`/bands/${testBandId}`)
        expect(res.status).toBe(200)
        console.log(res.body)
    })

    // UPDATE
    it("Should invite a new member through update", async () => {
        // Invite a new member through update
        const res = await request(app)
            .put(`/bands/${testBandId}`)
            .send({
                inviteMemberId: inviteeId2
            })
            .set("Authorization", `Bearer ${creatorToken}`);

        expect(res.status).toBe(200);
        const updatedBand = res.body;

        // Get the invite ID for invitee2
        const invite = await prisma.bandInvite.findFirst({
            where: {
                bandId: testBandId,
                userId: inviteeId2,
                status: "PENDING"
            }
        });
        expect(invite).toBeDefined();
        console.log(invite)
        const inviteId = invite!.id;

        // Invitee accepts the invite using invite ID
        const res2 = await request(app)
            .post(`/users/band-invites/${inviteId}/respond`)
            .set("Authorization", `Bearer ${invitee2Token}`)
            .send({ action: "ACCEPT" });

        console.log(res2.error)
        expect(res2.status).toBe(200);

        // Fetch updated members from response
        const members = res2.body.members.map((m: any) => m.userId);
        expect(members).toContain(inviteeId2);

        console.log("Updated Band:", updatedBand);
    });
    it("Should update band member role to MANAGER", async () => {
        const res = await request(app)
            .put(`/bands/${testBandId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                updateRole: { userId: inviteeId2, bandRole: "MANAGER" }
            });

        const updatedBand = res.body;
        const updatedMember = updatedBand.members.find(
            (m: any) => m.userId === inviteeId2
        );

        expect(updatedMember).toBeDefined();
        expect(updatedMember.role).toBe("MANAGER");
    })
    it("Should update band to remove a member", async () => {
        const res = await request(app)
            .put(`/bands/${testBandId}`)
            .send({
                removeMemberId: inviteeId1
            })
            .set("Authorization", `Bearer ${creatorToken}`);

        expect(res.status).toBe(200);
        const updatedBand = res.body;

        // Check member was removed
        const memberIds = updatedBand.members.map((m: any) => m.userId);
        expect(memberIds).not.toContain(inviteeId1);

        console.log("Updated Band: ", updatedBand);

    })

    // DELETE
    it("Should soft-delete a band and remove it from all tours", async () => {
        // Delete the band
        const deleteRes = await request(app)
            .delete(`/bands/${testBandId}`)
            .set("Authorization", `Bearer ${invitee2Token}`);

        expect(deleteRes.status).toBe(200);

        // Verify GET returns 404 (soft delete filter working)
        const getRes = await request(app).get(`/bands/${testBandId}`);
        expect(getRes.status).toBe(404);

        // Verify band still exists in DB but is soft-deleted
        const bandInDb = await prisma.band.findUnique({
            where: { id: testBandId }
        });
        expect(bandInDb).not.toBeNull();
        expect(bandInDb?.deletedAt).not.toBeNull();

        // Verify band members removed
        const bandMembers = await prisma.bandMember.findMany({
            where: { bandId: testBandId }
        });
        expect(bandMembers.length).toBe(0);

        // Verify no tour still has this band
        const toursWithBand = await prisma.tour.findMany({
            where: {
                bands: {
                    some: {
                        bandId: testBandId
                    }
                }
            }
        });
        expect(toursWithBand.length).toBe(0);
    });


})