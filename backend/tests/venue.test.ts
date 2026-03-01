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
})