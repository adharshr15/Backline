import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/app"
import { prisma } from "../src/lib/prisma"

let userId1: string
let userId2: string
let creatorId: string
let creatorToken: string
let inviteeId1: string
let inviteeToken1: string
let inviteeId2: string
let inviteeToken2: string
let testVenueId: string

beforeAll(async () => {
    // FULL clean
    await prisma.$transaction([
        prisma.show.deleteMany(),
        prisma.tour.deleteMany(),
        prisma.bandInvite.deleteMany(),
        prisma.venueInvite.deleteMany(),
        prisma.conversationParticipant.deleteMany(),
        prisma.message.deleteMany(),
        prisma.bandMember.deleteMany(),
        prisma.venueRepresentative.deleteMany(),
        prisma.conversation.deleteMany(),
        prisma.user.deleteMany(),
        prisma.band.deleteMany(),
        prisma.venue.deleteMany(),
    ])

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
    inviteeToken1 = invitee1.body.token;

    const invitee2 = await request(app)
        .post("/auth/register")
        .send({
            name: "Invitee 2",
            username: "invitee2",
            email: "invitee2@test.com",
            password: "password", city: "Austin", state: "TX", country: "USA",
        });
    inviteeId2 = invitee2.body.user.id;
    inviteeToken2 = invitee2.body.token;


})

afterAll(async () => {
    await prisma.$transaction([
        prisma.conversationParticipant.deleteMany(),
        prisma.bandInvite.deleteMany(),
        prisma.venueInvite.deleteMany(),
        prisma.message.deleteMany(),
        prisma.bandMember.deleteMany(),
        prisma.venueRepresentative.deleteMany(),
        prisma.user.deleteMany(),
        prisma.band.deleteMany(),
        prisma.venue.deleteMany(),
        prisma.conversation.deleteMany(),
    ])
})

describe("Venue API", () => {
    // CREATE
    it("Should create a venue", async () => {
        const res = await request(app)
            .post('/venues')
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                name: "The 101",
                city: "College Station",
                state: "Texas",
                country: "United States",
                contactEmail: "test3@gmail.com",
                representatives: [{ userId: inviteeId1 }, { userId: inviteeId2 }]
            })

        expect(res.status).toBe(201)
        testVenueId = res.body.id
        expect(testVenueId).toBeDefined()
        console.log(res.body)

        const repIds = res.body.representatives.map((m: any) => m.userId);
        expect(repIds).toContain(creatorId);

        // Invites should exist for invitees
        const invites = await prisma.venueInvite.findMany({ where: { venueId: testVenueId } });
        const inviteeIds = invites.map((i) => i.userId);
        expect(inviteeIds).toContain(inviteeId1);
        expect(inviteeIds).toContain(inviteeId2);
    })
    it("Should allow invitees to accept venue invitation requests", async () => {
        // Fetch the invites for the test venue
        const invites = await prisma.venueInvite.findMany({
            where: { venueId: testVenueId }
        });

        // Find each invitee's invite ID
        const invite1 = invites.find(i => i.userId === inviteeId1);
        const invite2 = invites.find(i => i.userId === inviteeId2);

        if (!invite1 || !invite2) throw new Error("Venue invites not found for test users");

        // Accept invitee1
        let res = await request(app)
            .post(`/users/venue-invites/${invite1.id}/respond`)
            .set("Authorization", `Bearer ${inviteeToken1}`)
            .send({ action: "ACCEPT" });

        expect(res.status).toBe(200);
        expect(res.body.representatives.map((r: any) => r.userId)).toContain(inviteeId1);

        // Decline invitee2
        res = await request(app)
            .post(`/users/venue-invites/${invite2.id}/respond`)
            .set("Authorization", `Bearer ${inviteeToken2}`)
            .send({ action: "DECLINE" });

        expect(res.status).toBe(200);

        // Ensure invitee2 is NOT a representative
        const venue = await prisma.venue.findUnique({
            where: { id: testVenueId },
            include: { representatives: true, invites: true },
        });

        const representativeIds = venue?.representatives.map((r) => r.userId);
        expect(representativeIds).not.toContain(inviteeId2);
    });

    // READ
    it("Should get all venues", async () => {
        const res = await request(app)
            .get('/venues')
        expect(res.status).toBe(200)
        console.log(res.body)
    })
    it("Should get a valid venue", async () => {
        const res = await request(app)
            .get(`/venues/${testVenueId}`)
        expect(res.status).toBe(200)
        expect(res.body.id).toBe(testVenueId)
    })

    it("Should update venue to invite new representative and update capacity", async () => {
        // Update venue capacity & send invite to invitee2
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                capacity: 300,
                inviteRepresentativeId: inviteeId2
            });

        expect(res.status).toBe(200);
        const updatedVenue = res.body;

        // Check capacity updated
        expect(updatedVenue.capacity).toBe(300);

        // Fetch the pending invite that should have been created
        const invites = await prisma.venueInvite.findMany({ where: { venueId: testVenueId } });
        console.log(invites)

        const invite = await prisma.venueInvite.findFirst({
            where: { venueId: testVenueId, userId: inviteeId2, status: "PENDING" }
        });
        expect(invite).toBeDefined();
        const inviteId = invite!.id;

        // Invitee2 accepts the invite via /users/venue-invites/:id/respond
        const res2 = await request(app)
            .post(`/users/venue-invites/${inviteId}/respond`)
            .set("Authorization", `Bearer ${inviteeToken2}`)
            .send({ action: "ACCEPT" });

        console.log(res2.error)
        expect(res2.status).toBe(200);

        // Check that representatives now include invitee2
        const venueAfterAccept = res2.body;
        const representativeIds = venueAfterAccept.representatives.map((r: any) => r.userId);
        expect(representativeIds).toContain(inviteeId2);
    });

    it("Should update venue representative role to MANAGER", async () => {
        // Make sure invitee2 is already a representative
        const rep = await prisma.venueRepresentative.findUnique({
            where: { userId_venueId: { userId: inviteeId2, venueId: testVenueId } }
        });
        expect(rep).toBeDefined();

        // Update role
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                updateRole: { userId: inviteeId2, venueRole: "MANAGER" }
            });

        expect(res.status).toBe(200);
        const updatedVenue = res.body;
        const updatedRep = updatedVenue.representatives.find((r: any) => r.userId === inviteeId2);
        expect(updatedRep).toBeDefined();
        expect(updatedRep.role).toBe("MANAGER");
    });

    it("Should update venue to remove a representative", async () => {
        // Make sure invitee2 is currently a representative
        const rep = await prisma.venueRepresentative.findUnique({
            where: { userId_venueId: { userId: inviteeId2, venueId: testVenueId } }
        });
        expect(rep).toBeDefined();

        // Remove representative
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                removeRepresentativeId: inviteeId2
            });

        expect(res.status).toBe(200);
        const updatedVenue = res.body;
        const repIds = updatedVenue.representatives.map((r: any) => r.userId);
        expect(repIds).not.toContain(inviteeId2);
    });

    // DELETE
    it("Should delete soft-delete a venue", async () => {
        const res = await request(app)
            .delete(`/venues/${testVenueId}`)
            .set("Authorization", `Bearer ${creatorToken}`);
        expect(res.status).toBe(200);

        const getRes = await request(app)
            .get(`/venues/${testVenueId}`);
        expect(getRes.status).toBe(404);

        const venueInDb = await prisma.venue.findUnique({
            where: { id: testVenueId }
        });
        expect(venueInDb).not.toBeNull();
        expect(venueInDb?.deletedAt).not.toBeNull();

        const venueReps = await prisma.venueRepresentative.findMany({
            where: { venueId: testVenueId }
        });
        expect(venueReps.length).toBe(0);



    })
})