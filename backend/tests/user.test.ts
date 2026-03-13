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

let adharshId: string
let adharshToken: string
let taylaId: string
let taylaToken: string
let nickId: string
let nickToken: string
let andresId: string
let andresToken: string
let frankieId: string
let frankieToken: string

let heelId: string
let toeId: string
let theFootId: string

let taylaBandInvite: string
let nickBandInvite: string
let andresVenueInvite: string

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
    it("Should create five users", async () => {
        const adharshRes = await request(app)
            .post('/auth/register')
            .send({
                name: "Adharsh Rajavel",
                password: "password",
                username: "adharsh",
                email: "adharsh@gmail.com"
            })

        adharshId = adharshRes.body.user.id
        adharshToken = adharshRes.body.token

        const taylaRes = await request(app)
            .post('/auth/register')
            .send({
                name: "Tayla",
                password: "password",
                username: "tayla",
                email: "tayla@gmail.com"
            })
        taylaId = taylaRes.body.user.id
        taylaToken = taylaRes.body.token

        const nickRes = await request(app)
            .post('/auth/register')
            .send({
                name: "Nick",
                password: "password",
                username: "nick",
                email: "nick@gmail.com"
            })
        nickId = nickRes.body.user.id
        nickToken = nickRes.body.token

        const andresRes = await request(app)
            .post('/auth/register')
            .send({
                name: "Andres",
                password: "password",
                username: "andres",
                email: "andres@gmail.com"
            })
        andresId = andresRes.body.user.id
        andresToken = andresRes.body.token

        const frankieRes = await request(app)
            .post('/auth/register')
            .send({
                name: "Frankie",
                password: "password",
                username: "frankie",
                email: "frankie@gmail.com"
            })
        frankieId = frankieRes.body.user.id
        frankieToken = frankieRes.body.token

        expect(adharshRes.status).toBe(201)
        expect(taylaRes.status).toBe(201)
        expect(nickRes.status).toBe(201)
        expect(andresRes.status).toBe(201)
        expect(frankieRes.status).toBe(201)
    })
    it("Should create bands and venue for users", async () => {
        const heelRes = await request(app)
            .post('/bands')
            .send({
                name: "Heel",
                members: [{ userId: adharshId }, { userId: taylaId }]
            })
            .set("Authorization", `Bearer ${adharshToken}`)

        expect(heelRes.status).toBe(201)
        heelId = heelRes.body.id
        expect(heelId).toBeDefined()

        const toeRes = await request(app)
            .post('/bands')
            .send({
                name: "Toe",
                members: [{ userId: nickId }, { userId: andresId }]
            })
            .set("Authorization", `Bearer ${andresToken}`)

        expect(toeRes.status).toBe(201)
        toeId = toeRes.body.id
        expect(toeId).toBeDefined()

        const theFootRes = await request(app)
            .post('/venues')
            .send({
                name: "The Foot",
                city: "College Station",
                state: "Texas",
                country: "United States",
                representatives: [{ userId: frankieId }, { userId: andresId }]
            })
            .set("Authorization", `Bearer ${frankieToken}`)

        expect(theFootRes.status).toBe(201)
        theFootId = theFootRes.body.id
        expect(theFootId).toBeDefined()
    })
    it("Should fail in creating a user with an existing username", async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({
                name: "test",
                username: "adharsh",
                password: "pass",
                email: "test@gmail"
            })

        expect(res.status).toBe(409)
    })
    it("Should fail in creating a user with an existing email", async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({
                name: "test",
                username: "new",
                password: "pas",
                email: "adharsh@gmail.com"
            })

        expect(res.status).toBe(409)
    })
    it("Should fail in creating a user without necessary fields", async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({
                name: "",
                username: "a",
                password: "p",
                email: "test"
            })
        expect(res.status).toBe(400)

        const res2 = await request(app)
            .post('/auth/register')
            .send({
                name: "a",
                username: "",
                password: "p",
                email: "test"
            })
        expect(res2.status).toBe(400)

        const res3 = await request(app)
            .post('/auth/register')
            .send({
                name: "a",
                username: "a",
                password: "",
                email: "test"
            })
        expect(res3.status).toBe(400)

        const res4 = await request(app)
            .post('/auth/register')
            .send({
                name: "a",
                username: "a",
                password: "p",
                email: ""
            })
        expect(res4.status).toBe(400)
    })

    // INVITES
    it("Should get a users invites", async () => {
        const res = await request(app)
            .get('/users/me/invites')
            .set("Authorization", `Bearer ${taylaToken}`)
        expect(res.status).toBe(200)
        expect(res.body.bandInvites.length).toBeGreaterThan(0)
        taylaBandInvite = res.body.bandInvites[0].id

        const res2 = await request(app)
            .get('/users/me/invites')
            .set('Authorization', `Bearer ${nickToken}`)
        expect(res2.status).toBe(200)
        expect(res2.body.bandInvites.length).toBeGreaterThan(0)
        nickBandInvite = res2.body.bandInvites[0].id

        const res3 = await request(app)
            .get('/users/me/invites')
            .set('Authorization', `Bearer ${andresToken}`)
        expect(res3.status).toBe(200)
        expect(res3.body.venueInvites.length).toBeGreaterThan(0)
        andresVenueInvite = res3.body.venueInvites[0].id

    })
    it("Should fail in responding to an invite", async () => {
        // invite doesn't belong to sender
        const res = await request(app)
            .post(`/users/band-invites/${taylaBandInvite}/respond`)
            .send({ action: "ACCEPT" })
            .set("Authorization", `Bearer ${andresToken}`)
        expect(res.status).toBe(403)

        // sender is unauthorized
        const res2 = await request(app)
            .post(`/users/band-invites/${nickBandInvite}/respond`)
            .send({ action: "ACCEPT" })
            .set("Authorization", `Bearer `)
        expect(res2.status).toBe(401)

        // invite doesn't exist
        const res3 = await request(app)
            .post(`/users/venue-invites/${nickBandInvite}/respond`)
            .send({ action: "ACCEPT" })
            .set("Authorization", `Bearer ${nickToken}`)
        expect(res3.status).toBe(404)
    })
    it("Should respond to band and venue invites", async () => {
        const res = await request(app)
            .post(`/users/band-invites/${taylaBandInvite}/respond`)
            .send({ action: "ACCEPT" })
            .set("Authorization", `Bearer ${taylaToken}`)
        expect(res.status).toBe(200)
        const heelMemberIds = res.body.members.map((m: any) => m.userId)
        expect(heelMemberIds).toContain(taylaId)

        const res2 = await request(app)
            .post(`/users/band-invites/${nickBandInvite}/respond`)
            .send({ action: "DECLINE" })
            .set("Authorization", `Bearer ${nickToken}`)
        expect(res.status).toBe(200)
        const toeMemberIds = res2.body.members.map((m: any) => m.userId)
        expect(toeMemberIds).not.toContain(nickId)

        const res3 = await request(app)
            .post(`/users/venue-invites/${andresVenueInvite}/respond`)
            .send({ action: "ACCEPT" })
            .set("Authorization", `Bearer ${andresToken}`)
        expect(res.status).toBe(200)
        const footRepIds = res3.body.representatives.map((m: any) => m.userId)
        expect(footRepIds).toContain(andresId)
    })
    it("Should fail in responding to an invite that has already been responded to", async () => {
        const res = await request(app)
            .post(`/users/band-invites/${taylaBandInvite}/respond`)
            .send({ action: "ACCEPT" })
            .set("Authorization", `Bearer ${taylaToken}`)
        console.log(res.body)
        expect(res.status).toBe(400)
    })

    // READ
    it("Should get all users", async () => {
        const res = await request(app)
            .get("/users")
            .set("Authorization", `Bearer ${adharshToken}`);
        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThan(0)
    })
    it("Should get a valid user", async () => {
        const res = await request(app)
            .get(`/users/${nickId}`)
            .set("Authorization", `Bearer ${taylaToken}`);
        expect(res.status).toBe(200)
        expect(res.body.id).toBe(nickId)
    })
    it("Should fail in getting an invalid user", async () => {
        const res = await request(app)
            .get("/users/invalid-user-id")
            .set("Authorization", `Bearer ${taylaToken}`);
        console.log(res.body)
        expect(res.status).toBe(404)
    })
    it("Should fail in getting a vaild user from an unauthorized sender", async () => {
        const res = await request(app)
            .get(`/users/${taylaId}`)
            .set("Authorization", `Bearer `)
        expect(res.status).toBe(401)
    })

    // UPDATE
    it("Should update a user including band/venue changes", async () => {
        const res1 = await request(app)
            .get(`/users/${andresId}`)
            .set("Authorization", `Bearer ${adharshToken}`)
        console.log(res1.body)


        const res = await request(app)
            .put(`/users/me`)
            .send({
                name: "Andres Gonzalez",
                email: "updated@test.com",
                removeBandId: toeId,
                removeVenueId: theFootId
            })
            .set("Authorization", `Bearer ${andresToken}`);
        console.log(res.error)
        expect(res.status).toBe(200)
        expect(res.body.name).toBe("Andres Gonzalez")
        expect(res.body.email).toBe("updated@test.com")

        // Confirm bandMemberships updated
        const bandMembers = await prisma.bandMember.findMany({ where: { userId: andresId } })
        expect(bandMembers.length).toBe(0)

        // Confirm venueReps updated
        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: andresId } })
        expect(venueReps.length).toBe(0)
        console.log(res.body);
    })
    it("Should fail in update a user without authorization", async () => {
        const res = await request(app)
            .put(`/users/me`)
            .send({
                name: "Harsh"
            })
            .set("Authorization", `Bearer`)
        expect(res.status).toBe(401);
    })
    it("Should fail in removing a member from a band that they are not in", async () => {
        const res = await request(app)
            .put(`/users/me`)
            .send({
                removeBandId: theFootId
            })
            .set("Authorization", `Bearer ${adharshToken}`)
        expect(res.status).toBe(500)
    })

    // DELETE
    it("Should delete a user and preserve messages", async () => {
        const deleteRes = await request(app)
            .delete(`/users/me`)
            .set("Authorization", `Bearer ${adharshToken}`)
        expect(deleteRes.status).toBe(200)

        const deleteRes2 = await request(app)
            .delete(`/users/me`)
            .set("Authorization", `Bearer ${frankieToken}`)
        expect(deleteRes2.status).toBe(200)

        const getRes = await request(app)
            .get(`/users/${adharshId}`)
            .set("Authorization", `Bearer ${andresToken}`)
        
        const getRes2 = await request(app)
            .get(`/users/${frankieId}`)
            .set("Authorization", `Bearer ${nickToken}`)

        expect(getRes.status).toBe(404)
        expect(getRes2.status).toBe(404)

        const bandMembers = await prisma.bandMember.findMany({ where: { userId: adharshId } })
        expect(bandMembers.length).toBe(0)

        const venueReps = await prisma.venueRepresentative.findMany({ where: { userId: frankieId } })
        expect(venueReps.length).toBe(0)
    })
})