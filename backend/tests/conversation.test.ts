import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let testConversationId: string
let user1Id: string
let user2Id: string
let user3Id: string

beforeAll(async () => {
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

  const user1 = await prisma.user.create({
    data: {
      name: "User1",
      username: "user1",
      email: "user1@test.com",
      password: "password",
      role: "USER"
    },
  })
  user1Id = user1.id

  const user2 = await prisma.user.create({
    data: {
      name: "User 2",
      username: "user2",
      email: "user2@test.com",
      password: "password",
      role: "USER"
    },
  })
  user2Id = user2.id

  const user3 = await prisma.user.create({
    data: {
      name: "User 3",
      username: "user3",
      email: "user3@test.com",
      password: "password",
      role: "USER"
    }
  })
  user3Id = user3.id
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

describe("Conversation Controller", () => {
  // CREATE
  it("Should create a conversation", async () => {
    const res = await request(app)
      .post("/conversations")
      .send({
        participantIds: [user1Id, user2Id],
      })

    expect(res.statusCode).toBe(201)
    testConversationId = res.body.id
    expect(res.body.participants.length).toBe(2)
    console.log(res.body)
  })
  it("Should fail with less than 2 participants", async () => {
    const res = await request(app)
      .post("/conversations")
      .send({
        participantIds: [user1Id],
      })

    expect(res.statusCode).toBe(400)
  })

  // READ
  it("Should read all conversations including user1", async () => {
    const res = await request(app)
      .get(`/conversations/user/${user1Id}`); // route matches your router

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true); // ensure the response is an array
    expect(res.body.length).toBeGreaterThan(0); // optional: check that at least one conversation is returned

    // Optional: check that user1 is included in each conversation
    res.body.forEach((conversation: any) => {
      const participantIds = conversation.participants.map((p: any) => p.user.id);
      expect(participantIds).toContain(user1Id);
    });

    console.log(res.body);
  });
  it("Should get conversation by ID", async () => {
    const res = await request(app)
      .get(`/conversations/${testConversationId}`)

    expect(res.statusCode).toBe(200)

    expect(res.body.id).toBe(testConversationId)

    expect(Array.isArray(res.body.participants)).toBe(true)

    const participantIds = res.body.participants.map((p: any) => p.user.id)

    expect(participantIds).toContain(user1Id)
    expect(participantIds).toContain(user2Id)

    console.log("Get Conversation:", res.body)
  })

  // UPDATE
  it("Should update conversation and add a participant", async () => {



    const res = await request(app)
      .put(`/conversations/${testConversationId}`)
      .send({
        addParticipantId: user3Id
      })

    expect(res.statusCode).toBe(200)

    const participantIds = res.body.participants.map((p: any) => p.user.id)

    expect(participantIds).toContain(user3Id)

    console.log("Updated Conversation:", res.body)
  })

  // DELETE
  it("Should soft delete a conversation", async () => {

    const res = await request(app)
      .delete(`/conversations/${testConversationId}`)

    expect(res.statusCode).toBe(200)

    const conversation = await prisma.conversation.findUnique({
      where: { id: testConversationId }
    })

    expect(conversation).not.toBeNull()
    expect(conversation?.deletedAt).not.toBeNull()

  })

})