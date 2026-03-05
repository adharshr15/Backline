import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let userId1: string
let userId2: string
let testVenueId: string

beforeAll(async () => {
    // FULL clean
    await prisma.$transaction([
        prisma.show.deleteMany(),
        prisma.tour.deleteMany(),
        prisma.conversationParticipant.deleteMany(),
        prisma.message.deleteMany(),
        prisma.bandMember.deleteMany(),
        prisma.venueRepresentative.deleteMany(),
        prisma.conversation.deleteMany(),
        prisma.user.deleteMany(),
        prisma.band.deleteMany(),
        prisma.venue.deleteMany(),
    ])

    // Create test user
    const user1 = await prisma.user.create({ 
        data: { 
            name: "Adharsh",
            email: "test@email.com",
            password: "password",
            role: "USER",
            username: "adharsh"
        }
    })
    userId1 = user1.id

    const user2 = await prisma.user.create({ 
        data: { 
            name: "Tayla",
            email: "test2@email.com",
            password: "password",
            role: "USER",
            username: "tayla"
        }
    })
    userId2 = user2.id


})

afterAll(async () => {
    await prisma.$transaction([
        prisma.conversationParticipant.deleteMany(),
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
            .send({
                name: "The 101",
                city: "College Station",
                state: "Texas",
                country: "United States",
                contactEmail: "test3@gmail.com",
                representatives: [{ userId: userId1 }]
            })
        
            expect(res.status).toBe(201)
            testVenueId = res.body.id
            expect(testVenueId).toBeDefined()
    })

    // READ
    it("Should get all venues", async () => {
        const res = await request(app).get('/venues')
        expect(res.status).toBe(200)
        console.log(res.body)
    })
    it("Should get a valid venue", async () => {
        const res = await request(app).get(`/venues/${testVenueId}`)
        expect(res.status).toBe(200)
        expect(res.body.id).toBe(testVenueId)
    })

    // UPDATE
    it("Should update venue to include new representative and capacity", async () => {
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .send({
                capacity: 300,
                addRepresentativeId: userId2
            })

        expect(res.status).toBe(200);
        const updatedVenue = res.body;

        // check venue capacity
        expect(updatedVenue.capacity).toBe(300);

        // check representatives array includes user 2
        const repIds = updatedVenue.representatives.map((m: any) => m.userId);
        expect(repIds).toContain(userId2);

        console.log("Update Venue: ", updatedVenue);
    })
    it("Should update venue to remove a representative", async () => {
        const res = await request(app)
            .put(`/venues/${testVenueId}`)
            .send({
                removeRepresentativeId: userId2
            })
        
            expect(res.status).toBe(200);
            const updatedVenue = res.body;

            // check representatives array doesnt include user 2
            const repIds = updatedVenue.representatives.map((m: any) => m.userId);
            expect(repIds).not.toContain(userId2)
    })
    it("Should delete soft-delete a venue", async () => {
        const res = await request(app)
            .delete(`/venues/${testVenueId}`);
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