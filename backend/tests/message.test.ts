import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let userId1: string
let userToken1: string
let userId2: string
let userToken2: string
let conversationId1: string
let testMessageId: string

beforeAll(async () => {
    await prisma.$transaction([
        prisma.message.deleteMany(),
        prisma.conversationParticipant.deleteMany(),
        prisma.conversation.deleteMany(),
        prisma.user.deleteMany(),
        prisma.showBand.deleteMany(),
        prisma.bandTour.deleteMany(),
        prisma.show.deleteMany(),
        prisma.tour.deleteMany(),
        prisma.bandMember.deleteMany(),
        prisma.band.deleteMany(),
    ]);

    const user1Res = await request(app)
        .post('/auth/register')
        .send({
            name: "Adharsh",
            username: "adharsh",
            email: "test@test.com",
            password: "password"
        })
    userId1 = user1Res.body.id
    userToken1 = user1Res.body.token

    const user2Res = await request(app)
        .post('/auth/register')
        .send({
            name: "User2",
            username: "msg2User",
            email: "msg2@test.com",
            password: "password"
        })
    userId2 = user2Res.body.id
    userToken2 = user2Res.body.token

    const conversation = await prisma.conversation.create({
        data: {
            participants: {
                create: [
                    { userId: userId1 },
                    { userId: userId2 }
                ]
            }
        },
        include: { participants: true }
    })
    conversationId1 = conversation.id
})

afterAll(async () => {
    await prisma.$transaction([
        prisma.message.deleteMany(),
        prisma.conversationParticipant.deleteMany(),
        prisma.conversation.deleteMany(),
        prisma.user.deleteMany(),
        prisma.showBand.deleteMany(),
        prisma.bandTour.deleteMany(),
        prisma.show.deleteMany(),
        prisma.tour.deleteMany(),
        prisma.bandMember.deleteMany(),
        prisma.band.deleteMany(),
    ]);

    await prisma.$disconnect();
})

describe("Message Controller", () => {
    // CREATE
    it("Should create a message in existing conversation", async () => {
        const res = await request(app)
            .post("/messages")
            .set("Authorization", `Bearer ${userToken1}`)
            .send({
                content: "Hello world",
                senderId: userId1,
                senderType: "USER",
                conversationId: conversationId1
            });

        console.log(res.error)

        expect(res.statusCode).toBe(201)
        expect(res.body.content).toBe("Hello world")
        expect(res.body.conversationId).toBe(conversationId1)
        testMessageId = res.body.id
    })

    // READ
    it("Should get messages for conversation", async () => {
        const res = await request(app)
            .get(`/messages/conversation/${conversationId1}`)
            .set("Authorization", `Bearer ${userToken1}`)

        expect(res.statusCode).toBe(200)
        expect(Array.isArray(res.body)).toBe(true)
        expect(res.body.length).toBeGreaterThan(0)
    })

    // DELETE
    it("Should soft delete a message", async () => {
        const res = await request(app)
            .delete(`/messages/${testMessageId}`)
            .set("Authorization", `Bearer ${userToken1}`)

        expect(res.status).toBe(200)
        expect(res.body.message).toBe("Message soft deleted successfully")

        const deletedMessage = await prisma.message.findUnique({ where: { id: testMessageId } })
        expect(deletedMessage?.deletedAt).not.toBeNull()
    })

    it("Should return 404 for non-existent message", async () => {
        const res = await request(app)
            .delete(`/messages/nonexistentid`)
            .set("Authorization", `Bearer ${userToken1}`)

        expect(res.status).toBe(404)
        expect(res.body.error).toBe("Message not found")
    })

    // CREATE MESSAGE → CONVERSATION INVITE FLOW
    it("Should create a conversation invite if conversation does not exist", async () => {
        const res = await request(app)
            .post("/messages")
            .set("Authorization", `Bearer ${userToken1}`)
            .send({
                content: "Hello via invite",
                senderId: userId1,
                senderType: "USER",
                recipientType: "USER",
                recipientId: userId2
            })

        expect(res.status).toBe(201)
        expect(res.body.invite).toBeDefined()
        expect(res.body.notice).toBe("Conversation invite created since conversation did not exist")
        expect(res.body.invite.message).toBe("Hello via invite")
    })
})