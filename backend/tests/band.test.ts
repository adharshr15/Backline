import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let testBandId: string
let userId1: string
let userId2: string
let userId3: string
let testTourId: string
let testShowId: string

beforeAll(async () => {
    // Clean test database in correct order
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

    // Create test users
    const user1 = await prisma.user.create({
        data: {
            email: "banduser1@test.com",
            password: "password",
            username: "harsh",
            name: "Adharsh Rajavel",
            role: "USER"
        }
    })
    userId1 = user1.id

    const user2 = await prisma.user.create({
        data: {
            email: "banduser2@test.com",
            password: "password",
            username: "tayla",
            name: "Tayla Diza",
            role: "USER"
        }
    })
    userId2 = user2.id

    const user3 = await prisma.user.create({
        data: {
            email: "banduser3@test.com",
            password: "password",
            username: "nick",
            name: "Nicholas Dienstbier",
            role: "USER"
        }
    })
    userId3 = user3.id


    // Create test tour
    const tour1 = await prisma.tour.create({
        data: {
            name: "Winter 2026"
        }
    });
    testTourId = tour1.id;
    console.log('testTourId: ', testTourId);

    const show1 = await prisma.show.create({
        data: {
            date: new Date(2026, 3, 4),
            city: "Austin",
            state: "Texas", 
            country: "United States"
        } 
    })
    testShowId = show1.id;

})

afterAll(async () => {
    // Cleanup DB completely after all tests
    await prisma.conversationParticipant.deleteMany()
    await prisma.bandMember.deleteMany()
    await prisma.venueRepresentative.deleteMany()
    await prisma.user.deleteMany()
    await prisma.band.deleteMany()
    await prisma.venue.deleteMany()
    await prisma.tour.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.$disconnect()
})

describe("Band API", () => {

    // CREATE
    it("Should create a band", async () => {
        const res = await request(app)
            .post("/bands")
            .send({
                name: "Heel",
                genre: "Shoegaze",
                city: "College Station",
                state: "Texas",
                country: "United States",
                members: [{ "userId": userId1, "role": "MEMBER" }, { "userId": userId2, "role": "MANAGER" }]
            })

        expect(res.status).toBe(201)
        testBandId = res.body.id
        expect(testBandId).toBeDefined()
        expect(res.body.name).toBe("Heel")
        console.log(res.body)
    })
    it("Should fail in creating a band without members", async () => {
        const res = await request(app)
            .post('/bands')
            .send({
                name: "asd",
                genre: "asd",
                city: "asd",
                state: "asd",
                country: "asd",
                members: []
            })

        expect(res.status).toBe(400)
    })

    // READ
    it("Should get all bands", async () => {
        const res = await request(app)
            .get("/bands")
        expect(res.status).toBe(200)
        console.log(res.body)
    })
    it("Should get a valid band", async () => {
        const res = await request(app)
            .get(`/bands/${testBandId}`)
        expect(res.status).toBe(200)
        console.log(res.body)
    })

    // UPDATE
    it("Should update band to include new member", async () => {
        const res = await request(app)
            .put(`/bands/${testBandId}`)
            .send({
                genre: "Electronic",
                addMemberId: { userId: userId3, bandRole: "MEMBER" },
                updateRole: { userId: userId1, bandRole: "MANAGER" }
            })

        expect(res.status).toBe(200);
        const updatedBand = res.body;

        // Check band genre updated
        expect(updatedBand.genre).toBe("Electronic");

        // Check members array includes userId3
        const memberIds = updatedBand.members.map((m: any) => m.userId);
        expect(memberIds).toContain(userId3);

        // Check that userId1 role was updated to MANAGER
        const updatedRole = updatedBand.members.find((m: any) => m.userId === userId1)?.role;
        expect(updatedRole).toBe("MANAGER");

        console.log("Updated Band:", updatedBand);
    })
    it("Should update band to remove a tour and member", async () => {
        const res = await request(app)
            .put(`/bands/${testBandId}`)
            .send({
                removeMemberId: userId3
            });

        expect(res.status).toBe(200);
        const updatedBand = res.body;

        // Check member was removed
        const memberIds = updatedBand.members.map((m: any) => m.userId);
        expect(memberIds).not.toContain(userId3);

        console.log("Updated Band: ", updatedBand);

    })

    // DELETE
    it("Should soft-delete a band and remove it from all tours", async () => {
        // Delete the band
        const deleteRes = await request(app).delete(`/bands/${testBandId}`);
        expect(deleteRes.status).toBe(200);

        // Verify GET returns 404 (soft delete filter working)
        const getRes = await request(app).get(`/bands/${testBandId}`);
        expect(getRes.status).toBe(404);

        // Verify band still exists in DB but is soft-deleted
        const bandInDb = await prisma.band.findUnique({
            where: { id: testBandId }
        });
        expect(bandInDb).not.toBeNull();
        expect(bandInDb?.deletedAt).not.toBeNull();

        // Verify band members removed
        const bandMembers = await prisma.bandMember.findMany({
            where: { bandId: testBandId }
        });
        expect(bandMembers.length).toBe(0);

        // Verify no tour still has this band
        const toursWithBand = await prisma.tour.findMany({
            where: {
                bands: {
                    some: {
                        bandId: testBandId
                    }
                }
            }
        });
        expect(toursWithBand.length).toBe(0);
    });


})