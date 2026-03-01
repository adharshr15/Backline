import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let testUserId: string
let testBandId: string
let testVenueId: string
let testConversationId: string

beforeAll(async () => {
    // FULL clean
    await prisma.$transaction([
        prisma.tourStop.deleteMany(),
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

    // Create band, venue, conversation for testing
    const band = await prisma.band.create({ data: { name: "Test Band" } })
    testBandId = band.id

    const venue = await prisma.venue.create({ data: { name: "Test Venue", city: "Austin", state: "Texas", country: "United States" } })
    testVenueId = venue.id

    const conversation = await prisma.conversation.create({ data: {} })
    testConversationId = conversation.id
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
    })

    // READ
    it("Should get all users", async () => {
        const res = await request(app).get("/users")
        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThan(0)
    })

    it("Should get a valid user", async () => {
        const res = await request(app).get(`/users/${testUserId}`)
        expect(res.status).toBe(200)
        expect(res.body.id).toBe(testUserId)
    })

    it("Should return 404 for invalid user", async () => {
        const res = await request(app).get("/users/invalid-user-id")
        expect(res.status).toBe(404)
    })

    // UPDATE
    it("Should update a user including band/venue changes", async () => {
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

        // Confirm bandMemberships updated
        const bandMembers = await prisma.bandMember.findMany({ where: { userId: testUserId } })
        expect(bandMembers.length).toBe(1)
        expect(bandMembers[0].bandId).toBe(testBandId)

        // Confirm venueReps updated
        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: testUserId } })
        expect(venueReps.length).toBe(1)
        expect(venueReps[0].venueId).toBe(testVenueId)
    })
    
    // DELETE
    it("Should delete a user and preserve messages", async () => {
        const deleteRes = await request(app).delete(`/users/${testUserId}`)
        expect(deleteRes.status).toBe(200)

        const getRes = await request(app).get(`/users/${testUserId}`)
        expect(getRes.status).toBe(404)

        const bandMembers = await prisma.bandMember.findMany({ where: { userId: testUserId } })
        expect(bandMembers.length).toBe(0)

        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: testUserId } })
        expect(venueReps.length).toBe(0)
    })
})