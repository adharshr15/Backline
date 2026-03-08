import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/index"
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
            password: "password",
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
            password: "password",
        });
    inviteeId1 = invitee1.body.user.id;
    inviteeToken1 = invitee1.body.token;

    const invitee2 = await request(app)
        .post("/auth/register")
        .send({
            name: "Invitee 2",
            username: "invitee2",
            email: "invitee2@test.com",
            password: "password",
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
    })
    it("Should allow invitees to accept venue invitation requests", async () => {
        // Accept invitee1
        let res = await request(app)
            .post(`/venues/${testVenueId}/invite/respond`)
            .set("Authorization", `Bearer ${inviteeToken1}`)
            .send({ action: "ACCEPT" });

        expect(res.status).toBe(200);
        expect(res.body.representatives.map((r: any) => r.userId)).toContain(inviteeId1);

        // Decline invitee2
        res = await request(app)
            .post(`/venues/${testVenueId}/invite/respond`)
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

    // UPDATE
    it("Should update venue to invite new representative and update capacity", async () => {
        // Update venue capacity & send invite to user2
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                capacity: 300,
                inviteRepresentativeId: inviteeId2
            });

        expect(res.status).toBe(200);
        const updatedVenue = res.body;

        // check venue capacity updated
        expect(updatedVenue.capacity).toBe(300);

        // Invitee2 accepts the invite
        const res2 = await request(app)
            .post(`/venues/${testVenueId}/invite/respond`)
            .set("Authorization", `Bearer ${inviteeToken2}`)
            .send({ action: "ACCEPT" });
        
        console.log(res2.body)
        expect(res2.status).toBe(200);

        // Check that representatives now includes invitee2
        const venueAfterAccept = res2.body;
        const representativeIds = venueAfterAccept.representatives.map((r: any) => r.userId);
        expect(representativeIds).toContain(inviteeId2);

        const venue = await request(app).get(`/venues/${testVenueId}`)
        

        console.log(venue.body)
    });
    it("Should update venue representative role to MANAGER", async () => {
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                updateRole: { userId: inviteeId2, venueRole: "MANAGER"}
            });
        
        console.log(res.error)
        expect(res.status).toBe(200);

        const updatedVenue = res.body;
        const updatedRepresentative = updatedVenue.representatives.find(
            (m: any) => m.userId === inviteeId2
        );

        expect(updatedRepresentative).toBeDefined();
        expect(updatedRepresentative.role).toBe("MANAGER");
    })
    it("Should update venue to remove a representative", async () => {
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
                removeRepresentativeId: inviteeId2
            })

        expect(res.status).toBe(200);
        const updatedVenue = res.body;

        // check representatives array doesnt include user 2
        const repIds = updatedVenue.representatives.map((m: any) => m.userId);
        expect(repIds).not.toContain(inviteeId2)
    }) 

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