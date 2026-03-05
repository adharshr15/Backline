import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let userId1: string
let userId2: string
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

    const user = await prisma.user.create({
        data: {
            name: "User",
            username: "msgUser",
            email: "msg@test.com",
            password: "password",
            role: "USER"
        },
    })
    userId1 = user.id
    const user2 = await prisma.user.create({
        data: {
            name: "User2",
            username: "msg2User",
            email: "msg2@test.com",
            password: "password",
            role: "USER"
        },
    })
    userId2 = user2.id

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
        // Messages first (depends on conversation)
        prisma.message.deleteMany(),
        // Conversation participants next
        prisma.conversationParticipant.deleteMany(),
        // Then conversations
        prisma.conversation.deleteMany(),
        // Now users
        prisma.user.deleteMany(),

        // Other unrelated models
        prisma.showBand.deleteMany(),
        prisma.bandTour.deleteMany(),
        prisma.show.deleteMany(),
        prisma.tour.deleteMany(),
        prisma.bandMember.deleteMany(),
        prisma.band.deleteMany(),
    ]);

    await prisma.$disconnect();
});

describe("Message Controller", () => {
    // CREATE
    it("Should create a message", async () => {
        const res = await request(app)
            .post("/messages")
            .send({
                content: "Hello world",
                senderId: userId1,
                conversationId: conversationId1,
            })

        expect(res.statusCode).toBe(201)
        expect(res.body.content).toBe("Hello world")
        testMessageId = res.body.id
        console.log(res.body)
    })

    // READ
    it("Should get messages for conversation", async () => {
        const res = await request(app)
            .get(`/messages/conversation/${conversationId1}`)

        expect(res.statusCode).toBe(200)
        expect(Array.isArray(res.body)).toBe(true)
        console.log(res.body)
    })

    // DELETE 
    it("should soft delete a message", async () => {
        const res = await request(app).delete(`/messages/${testMessageId}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Message soft deleted successfully");
        expect(res.body.message.deletedAt).not.toBeNull();

        // Verify in DB that deletedAt is set
        const deletedMessage = await prisma.message.findUnique({ where: { id: testMessageId } });
        expect(deletedMessage?.deletedAt).not.toBeNull();
    });

    it("should return 404 for non-existent message", async () => {
        const res = await request(app).delete(`/messages/nonexistentid`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Message not found");
    });
})