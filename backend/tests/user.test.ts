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
    it("Should create a user with band, venue, and conversation", async () => {
        const res = await request(app)
            .post("/users")
            .send({
                email: "test@test.com",
                password: "123456",
                username: "tester",
                name: "Tester",
                role: "BAND",
                bandId: testBandId,
                bandRole: "MEMBER",
                venueId: testVenueId,
                addConversationId: testConversationId
            })

        expect(res.status).toBe(201)
        expect(res.body.email).toBe("test@test.com")
        testUserId = res.body.id
        expect(testUserId).toBeDefined()
        console.log(res.body)
    });
    it("Should create a user without band, venue, and conversation", async () => {
        const res = await request(app)
            .post("/users")
            .send({
                email: "test2@test.com",
                password: "7890123",
                username: "tester2",
                name: "Tester 2",
                role: "ADMIN"
            })
        
            expect(res.status).toBe(201)
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
                bandRole: "LEAD",
                removeBandId: null,
                addConversationId: testConversationId,
                removeVenueId: null
            })

        expect(res.status).toBe(200)
        expect(res.body.name).toBe("Updated Tester")
        expect(res.body.email).toBe("updated@test.com")
        console.log(res.body)
    })

    // DELETE
    it("Should delete a user", async () => {
        const res = await request(app)
            .delete(`/users/${testUserId}`)
        expect(res.status).toBe(200)
    })

    it("Should return 404 after deletion", async () => {
        const res = await request(app)
            .get(`/users/${testUserId}`)
        expect(res.status).toBe(404)
    })
})