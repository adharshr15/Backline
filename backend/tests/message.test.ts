import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/app"
import { prisma } from "../src/lib/prisma"
import { ParticipantType } from "../generated/prisma/enums"

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

  // Create test users
  const creatorRes = await request(app)
    .post("/auth/register")
    .send({
      name: "Adharsh",
      username: "creator",
      email: "creator@test.com",
      password: "password", city: "Austin", state: "TX", country: "USA",
    });

  userId1 = creatorRes.body.user.id;
  userToken1 = creatorRes.body.token;

  // Create invitee user
  const inviteeRes = await request(app)
    .post("/auth/register")
    .send({
      name: "Tayla",
      username: "invitee1",
      email: "invitee1@test.com",
      password: "password", city: "Austin", state: "TX", country: "USA",
    });
  userId2 = inviteeRes.body.user.id;
  userToken2 = inviteeRes.body.token;

  const conversationRes = await request(app)
    .post("/conversations")
    .set("Authorization", `Bearer ${userToken1}`)
    .send({
      userIds: [userId2],
      senderType: "USER",
      senderId: userId1,
      content: "Hi Tayla"
    })
  conversationId1 = conversationRes.body.id

  console.log(conversationRes.body)

  const invite = await prisma.conversationInvite.findFirst({
    where: {
      conversationId: conversationId1,
      recipientUserId: userId2
    }
  });

  const respondRes = await request(app)
    .post(`/conversations/conversation-invites/${invite!.id}/respond`)
    .set("Authorization", `Bearer ${userToken2}`)
    .send({
      participantType: "USER",
      participantId: userId2,
      action: "ACCEPT"
    })

  console.log(respondRes.body)
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
      .post(`/conversations/${conversationId1}/messages`)
      .set("Authorization", `Bearer ${userToken2}`)
      .send({
        content: "Hi Adharsh",
        senderType: "USER",
        senderId: userId2
      })

    console.log(res.body)
    expect(res.status).toBe(201)
  })
  it("Should get all messages in an existing conversation", async () => {
    const res = await request(app)
      .get(`/conversations/${conversationId1}/messages`)
      .set("Authorization", `Bearer ${userToken1}`)
      .query({
        senderType: "USER",
        senderId: userId1
      })

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
  })
})