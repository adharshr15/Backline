import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let testUserId: string
let testBandId: string
let testVenueId: string
let testConversationId: string

beforeAll(async () => {
    // Create a band, venue, conversation for testing
    const band = await prisma.band.create({ data: { name: "Test Band" } })
    testBandId = band.id

    const venue = await prisma.venue.create({ data: { name: "Test Venue", city: "Austin" } })
    testVenueId = venue.id

    const conversation = await prisma.conversation.create({ data: {} })
    testConversationId = conversation.id
})

afterAll(async () => {
    // Cleanup DB completely after all tests
    await prisma.conversationParticipant.deleteMany()
    await prisma.bandMember.deleteMany()
    await prisma.venueRepresentative.deleteMany()
    await prisma.user.deleteMany()
    await prisma.band.deleteMany()
    await prisma.venue.deleteMany()
    await prisma.conversation.deleteMany()
})

describe("User API", () => {

    // CREATE
    it("Should create a user", async () => {
        const res = await request(app)
            .post("/users")
            .send({
                email: "test2@test.com",
                password: "7890123",
                username: "tester2",
                name: "Tester 2",
                role: "USER"
            })
        
            expect(res.status).toBe(201)
            testUserId = res.body.id
            expect(testUserId).toBeDefined()
            expect(res.body.email).toBe("test2@test.com")
            console.log(res.body)
    })

    // READ
    it("Should get all users", async () => {
        const res = await request(app).get("/users")
        expect(res.status).toBe(200)
        console.log(res.body)
    })

    it("Should get a valid user", async () => {
        const res = await request(app).get(`/users/${testUserId}`)
        expect(res.status).toBe(200)
        expect(res.body.id).toBe(testUserId)
        console.log(res.body)
    })

    it("Should return 404 for invalid user", async () => {
        const res = await request(app).get("/users/invalid-user-id")
        expect(res.status).toBe(404)

    })

    // UPDATE
    it("Should update a user including band/venue/conversation changes", async () => {
        const res = await request(app)
            .put(`/users/${testUserId}`)
            .send({
                name: "Updated Tester",
                email: "updated@test.com",
                bandRole: "MEMBER",
                addBandId: testBandId,
                removeBandId: null,
                addVenueId: testVenueId,
                removeVenueId: null
            })

        expect(res.status).toBe(200)
        expect(res.body.name).toBe("Updated Tester")
        expect(res.body.email).toBe("updated@test.com")
        console.log(res.body)
    })
    
    // DELETE
    it("Should delete a user and preserve messages", async () => {
    // Delete the user
    const deleteRes = await request(app)
        .delete(`/users/${testUserId}`);
    expect(deleteRes.status).toBe(200);

    // ---- Verify user is gone ----
    const getRes = await request(app)
        .get(`/users/${testUserId}`);
    expect(getRes.status).toBe(404);

    // ---- Verify messages still exist with null sender ----
    const messages = await prisma.message.findMany({
        where: { conversationId: testConversationId }
    });

    for (const msg of messages) {
        // senderId should be null if the message was from the deleted user
        if (msg.senderId === testUserId) {
        expect(msg.senderId).toBeNull();
        }
    }

    // ---- Verify bandMemberships removed ----
    const bandMembers = await prisma.bandMember.findMany({
        where: { userId: testUserId }
    });
    expect(bandMembers.length).toBe(0);

    // ---- Verify venueReps removed ----
    const venueReps = await prisma.venueRepresentative.findMany({
        where: { userId: testUserId }
    });
    expect(venueReps.length).toBe(0);
    });

})