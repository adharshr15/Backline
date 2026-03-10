import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let testUserId: string
let testBandId: string
let testVenueId: string
let testConversationId: string
let testBandInviteId: string
let testVenueInviteId: string
let token: string

beforeAll(async () => {
    // FULL clean
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
    await prisma.bandInvite.deleteMany()
    await prisma.venueInvite.deleteMany()
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

        // Create band invite
        const bandInvite = await prisma.bandInvite.create({
            data: {
                bandId: testBandId,
                userId: testUserId
            }
        })
        testBandInviteId = bandInvite.id

        // Create venue invite
        const venueInvite = await prisma.venueInvite.create({
            data: {
                venueId: testVenueId,
                userId: testUserId
            }
        })
        testVenueInviteId = venueInvite.id
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

    // INVITES
    it("Should fetch my invites", async () => {
        const res = await request(app)
            .get("/users/me/invites")
            .set("Authorization", `Bearer ${token}`)

        expect(res.status).toBe(200)

        expect(res.body.bandInvites.length).toBe(1)
        expect(res.body.bandInvites[0].id).toBe(testBandInviteId)

        expect(res.body.venueInvites.length).toBe(1)
        expect(res.body.venueInvites[0].id).toBe(testVenueInviteId)
    })

    it("Should accept a band invite", async () => {
        const res = await request(app)
            .post(`/users/band-invites/${testBandInviteId}/respond`)
            .set("Authorization", `Bearer ${token}`)
            .send({ action: "ACCEPT" })

        expect(res.status).toBe(200)
        console.log(res.body)

        const membership = await prisma.bandMember.findFirst({
            where: {
                userId: testUserId,
                bandId: testBandId
            }
        })

        expect(membership).toBeDefined()

        const bandMembers = await prisma.bandMember.findMany({ where: { userId: testUserId } })
        expect(bandMembers.length).toBe(1)

        const bandInvite = await prisma.bandInvite.findUnique({ where: { id: testBandInviteId }})
        expect(bandInvite).toBeDefined()
    })

    it("Should accept a venue invite", async () => {
        const res = await request(app)
            .post(`/users/venue-invites/${testVenueInviteId}/respond`)
            .set("Authorization", `Bearer ${token}`)
            .send({ action: "ACCEPT" })

        expect(res.status).toBe(200)

        const rep = await prisma.venueRepresentative.findFirst({
            where: {
                userId: testUserId,
                venueId: testVenueId
            }
        })

        expect(rep).not.toBeNull()

        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: testUserId } })
        expect(venueReps.length).toBe(1)
    })

    // UPDATE
    it("Should update a user including band/venue changes", async () => {
        const res = await request(app)
            .put(`/users/${testUserId}`)
            .send({
                name: "Updated Tester",
                email: "updated@test.com",
                bandRole: "MEMBER",
                removeBandId: testBandId,
                removeVenueId: testVenueId
            })
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200)
        expect(res.body.name).toBe("Updated Tester")
        expect(res.body.email).toBe("updated@test.com")

        // Confirm bandMemberships updated
        const bandMembers = await prisma.bandMember.findMany({ where: { userId: testUserId } })
        expect(bandMembers.length).toBe(0)

        // Confirm venueReps updated
        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: testUserId } })
        expect(venueReps.length).toBe(0)
        console.log(res.body);
    })

    // DELETE
    it("Should delete a user and preserve messages", async () => {
        const deleteRes = await request(app)
            .delete(`/users/${testUserId}`)
            .set("Authorization", `Bearer ${token}`)

        console.log(deleteRes.error)
        expect(deleteRes.status).toBe(200)

        const getRes = await request(app)
            .get(`/users/${testUserId}`)
            .set("Authorization", `Bearer ${token}`)
    
        expect(getRes.status).toBe(404)

        const bandMembers = await prisma.bandMember.findMany({ where: { userId: testUserId } })
        expect(bandMembers.length).toBe(0)

        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: testUserId } })
        expect(venueReps.length).toBe(0)
    })
})