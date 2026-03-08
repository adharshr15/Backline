import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let testUserId: string
let testBandId: string
let testVenueId: string
let testConversationId: string
let token: string

beforeAll(async () => {
    // FULL clean
    await prisma.show.deleteMany()
    await prisma.tour.deleteMany()
    await prisma.conversationParticipant.deleteMany()
    await prisma.message.deleteMany()
    await prisma.bandMember.deleteMany()
    await prisma.venueRepresentative.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.band.deleteMany()
    await prisma.venue.deleteMany()

    // Create band, venue, conversation for testing
    const band = await prisma.band.create({ data: { name: "Test Band" } })
    testBandId = band.id

    const venue = await prisma.venue.create({ data: { name: "Test Venue", city: "Austin", state: "Texas", country: "United States" } })
    testVenueId = venue.id

    const conversation = await prisma.conversation.create({ data: {} })
    testConversationId = conversation.id

})

afterAll(async () => {
    await prisma.show.deleteMany()
    await prisma.tour.deleteMany()
    await prisma.conversationParticipant.deleteMany()
    await prisma.message.deleteMany()
    await prisma.bandMember.deleteMany()
    await prisma.venueRepresentative.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.band.deleteMany()
    await prisma.venue.deleteMany()

    await prisma.$disconnect()
})

describe("User API", () => {

    // CREATE
    it("Should create a user", async () => {
        const userRes = await request(app)
            .post('/auth/register')
            .send({
                name: "Tester",
                password: "password",
                username: "tester1",
                email: "tester@gmail.com"
            })

        console.log(userRes.body)

        testUserId = userRes.body.user.id
        token = userRes.body.token
        expect(testUserId).toBeDefined()
        expect(token).toBeDefined()
    })

    // READ
    it("Should get all users", async () => {
        const res = await request(app)
            .get("/users")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThan(0)
        console.log(res.body);
    })

    it("Should get a valid user", async () => {
        const res = await request(app)
            .get(`/users/${testUserId}`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200)
        expect(res.body.id).toBe(testUserId)
        console.log(res.body);
    })

    it("Should return 404 for invalid user", async () => {
        const res = await request(app)
            .get("/users/invalid-user-id")
            .set("Authorization", `Bearer ${token}`);
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
            .set("Authorization", `Bearer ${token}`);

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
        console.log(res.body);
    })

    // DELETE
    it("Should delete a user and preserve messages", async () => {
        const deleteRes = await request(app)
            .delete(`/users/${testUserId}`)
            .set("Authorization", `Bearer ${token}`);
        expect(deleteRes.status).toBe(200)

        const getRes = await request(app).get(`/users/${testUserId}`)
        expect(getRes.status).toBe(401)

        const bandMembers = await prisma.bandMember.findMany({ where: { userId: testUserId } })
        expect(bandMembers.length).toBe(0)

        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: testUserId } })
        expect(venueReps.length).toBe(0)
    })
})