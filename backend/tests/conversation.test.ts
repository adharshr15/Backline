import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"
import { ParticipantType } from "../generated/prisma/enums"

let testConversationId1: string
let testConversationId2: string
let testConversationId3: string
let testConversationId4: string
let creatorId: string
let creatorToken: string
let inviteeId: string
let inviteeToken: string
let band1Id: string
let band2Id: string
let bandTokenMap: string[]
let venue1Id: string
let user3Id: string

beforeAll(async () => {
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

  // Create test users
  const creatorRes = await request(app)
    .post("/auth/register")
    .send({
      name: "Creator User",
      username: "creator",
      email: "creator@test.com",
      password: "password",
    });

  creatorId = creatorRes.body.user.id;
  creatorToken = creatorRes.body.token;

  // Create invitee user
  const inviteeRes = await request(app)
    .post("/auth/register")
    .send({
      name: "Invitee 1",
      username: "invitee1",
      email: "invitee1@test.com",
      password: "password",
    });
  inviteeId = inviteeRes.body.user.id;
  inviteeToken = inviteeRes.body.token;

  // Create invitee bands
  const band1Res = await request(app)
    .post("/bands")
    .send({
      name: "Invitee Band",
      genre: "Shoegaze",
      city: "College Station",
      state: "Texas",
      country: "USA",
      members: [{ userId: inviteeId }]
    })
    .set("Authorization", `Bearer ${inviteeToken}`);
  band1Id = band1Res.body.id

  const band2Res = await request(app)
    .post("/bands")
    .send({
      name: "Invitee Band 2",
      genre: "Shoegaze",
      city: "College Station",
      state: "Texas",
      country: "USA",
      members: [{ userId: creatorId }]
    })
    .set("Authorization", `Bearer ${creatorToken}`);
  band2Id = band2Res.body.id

  const venueRes = await request(app)
    .post("/venues")
    .send({
      name: "Venue",
      city: "College Station",
      state: "Texas",
      country: "United States",
      contactEmail: "test3@gmail.com",
      representatives: [{ userId: inviteeId }]
    })
    .set("Authorization", `Bearer ${inviteeToken}`)
  venue1Id = venueRes.body.id



})


afterAll(async () => {
  // Cleanup DB completely after all tests
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
})

describe("Conversation Controller", () => {
  // CREATE
  it("Should create a conversation between a user and a user", async () => {
    const res = await request(app)
      .post("/conversations")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        userIds: [inviteeId],
        senderType: "USER",
        senderId: creatorId,
        content: "Hi"
      })

    expect(res.status).toBe(201);
    testConversationId1 = res.body.id;
    expect(testConversationId1).toBeDefined();

    console.log(res.body)

    // creator should be a participant
    const participantIds = res.body.participants.map((p: any) => p.userId);
    expect(participantIds).toContain(creatorId)

    // invites should exist for invitees
    const invite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId1,
        recipientUserId: inviteeId
      }
    });

    expect(invite).toBeDefined();

    const respondRes = await request(app)
      .post(`/conversations/conversation-invites/${invite!.id}/respond`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        participantType: "USER",
        participantId: inviteeId,
        action: "ACCEPT"
      })

    console.log(respondRes.body)
    expect(respondRes.status).toBe(200);

    // verify invite status updated
    const updatedInvite = await prisma.conversationInvite.findUnique({
      where: { id: invite!.id }
    });

    expect(updatedInvite?.status).toBe("ACCEPTED");

    // verify user is now a participant
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: testConversationId1 }
    });

    const participantUserIds = participants.map(p => p.userId);
    expect(participantUserIds).toContain(inviteeId);

  });
  it("Should create a conversation between a user and a band", async () => {
    const res = await request(app)
      .post("/conversations")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        bandIds: [band1Id],
        senderType: "USER",
        senderId: creatorId,
        content: "Hello"
      })

    expect(res.status).toBe(201);
    testConversationId2 = res.body.id;
    expect(testConversationId2).toBeDefined();

    console.log(res.body)

    // creator should be a participant
    const participantIds = res.body.participants.map((p: any) => p.userId);
    expect(participantIds).toContain(creatorId)

    // invites should exist for invitees
    const invite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId2,
        recipientBandId: band1Id
      }
    });

    expect(invite).toBeDefined();

    const respondRes = await request(app)
      .post(`/conversations/conversation-invites/${invite!.id}/respond`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        participantType: "BAND",
        participantId: band1Id,
        action: "ACCEPT"
      })

    console.log(respondRes.body)
    expect(respondRes.status).toBe(200);

    // verify invite status updated
    const updatedInvite = await prisma.conversationInvite.findUnique({
      where: { id: invite!.id }
    });

    expect(updatedInvite?.status).toBe("ACCEPTED");

    // verify band is now a participant
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: testConversationId2 }
    });

    const participantUserIds = participants.map(p => p.bandId);
    expect(participantUserIds).toContain(band1Id);


  });
  it("Should create a conversation between a venue and a band", async () => {
    const res = await request(app)
      .post('/conversations')
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        bandIds: [band2Id],
        senderType: "VENUE",
        senderId: venue1Id,
        content: "Howdy"
      })

    expect(res.status).toBe(201);
    testConversationId3 = res.body.id;
    expect(testConversationId3).toBeDefined();

    console.log(res.body)

    // creator should be a participant
    const participantIds = res.body.participants.map((p: any) => p.venueId);
    expect(participantIds).toContain(venue1Id)

    // invites should exist for invitees
    const invite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId3,
        recipientBandId: band2Id
      }
    });

    expect(invite).toBeDefined();

    const respondRes = await request(app)
      .post(`/conversations/conversation-invites/${invite!.id}/respond`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        participantType: "BAND",
        participantId: band2Id,
        action: "ACCEPT"
      })

    console.log(respondRes.body)
    expect(respondRes.status).toBe(200);

    // verify invite status updated
    const updatedInvite = await prisma.conversationInvite.findUnique({
      where: { id: invite!.id }
    });

    expect(updatedInvite?.status).toBe("ACCEPTED");

    // verify band is now a participant
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: testConversationId3 }
    });

    const participantUserIds = participants.map(p => p.bandId);
    expect(participantUserIds).toContain(band2Id);
  });
  it("Should create a groupchat between two users, two bands and one venue, accept all except one user", async () => {
    const res = await request(app)
      .post("/conversations")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        bandIds: [band1Id, band2Id],
        venueIds: [venue1Id],
        userIds: [inviteeId],
        name: "groupchat",
        senderType: "USER",
        senderId: creatorId,
        content: "show groupchat"
      });

    expect(res.status).toBe(201);
    testConversationId4 = res.body.id;

    // fetch all invites
    const invites = await prisma.conversationInvite.findMany({
      where: { conversationId: testConversationId4 }
    });

    expect(invites.length).toBe(4);

    // BAND 1 
    const band1Invite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId4,
        recipientBandId: band1Id
      }
    });

    expect(band1Invite).toBeDefined();

    const band1Respond = await request(app)
      .post(`/conversations/conversation-invites/${band1Invite!.id}/respond`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        participantType: "BAND",
        participantId: band1Id,
        action: "ACCEPT"
      });

    expect(band1Respond.status).toBe(200);

    const updatedBand1Invite = await prisma.conversationInvite.findUnique({
      where: { id: band1Invite!.id }
    });

    expect(updatedBand1Invite?.status).toBe("ACCEPTED");


    // BAND 2 
    const band2Invite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId4,
        recipientBandId: band2Id
      }
    });

    expect(band2Invite).toBeDefined();

    const band2Respond = await request(app)
      .post(`/conversations/conversation-invites/${band2Invite!.id}/respond`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        participantType: "BAND",
        participantId: band2Id,
        action: "ACCEPT"
      });

    expect(band2Respond.status).toBe(200);

    const updatedBand2Invite = await prisma.conversationInvite.findUnique({
      where: { id: band2Invite!.id }
    });

    expect(updatedBand2Invite?.status).toBe("ACCEPTED");


    // VENUE 
    const venueInvite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId4,
        recipientVenueId: venue1Id
      }
    });

    expect(venueInvite).toBeDefined();

    const venueRespond = await request(app)
      .post(`/conversations/conversation-invites/${venueInvite!.id}/respond`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        participantType: "VENUE",
        participantId: venue1Id,
        action: "ACCEPT"
      });

    expect(venueRespond.status).toBe(200);

    const updatedVenueInvite = await prisma.conversationInvite.findUnique({
      where: { id: venueInvite!.id }
    });

    expect(updatedVenueInvite?.status).toBe("ACCEPTED");

    console.log(venueRespond.body)


    // USER (DO NOT ACCEPT) 
    const userInvite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId4,
        recipientUserId: inviteeId
      }
    });

    expect(userInvite).toBeDefined();


    // VERIFY PARTICIPANTS 
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: testConversationId4 }
    });

    // creator
    expect(participants.map(p => p.userId)).toContain(creatorId);

    // bands added
    expect(participants.map(p => p.bandId)).toContain(band1Id);
    expect(participants.map(p => p.bandId)).toContain(band2Id);

    // venue added
    expect(participants.map(p => p.venueId)).toContain(venue1Id);

    // user NOT added
    expect(participants.map(p => p.userId)).not.toContain(inviteeId);


    //  VERIFY INVITE STATUSES 
    const finalBand1Invite = await prisma.conversationInvite.findUnique({
      where: { id: band1Invite!.id }
    });
    expect(finalBand1Invite?.status).toBe("ACCEPTED");

    const finalBand2Invite = await prisma.conversationInvite.findUnique({
      where: { id: band2Invite!.id }
    });
    expect(finalBand2Invite?.status).toBe("ACCEPTED");

    const finalVenueInvite = await prisma.conversationInvite.findUnique({
      where: { id: venueInvite!.id }
    });
    expect(finalVenueInvite?.status).toBe("ACCEPTED");

    const finalUserInvite = await prisma.conversationInvite.findUnique({
      where: { id: userInvite!.id }
    });
    expect(finalUserInvite?.status).toBe("PENDING");
  });

  // UPDATE
  it("Should update a conversation to remove a band, add a user", async () => {
    const res = await request(app)
      .put(`/conversations/${testConversationId4}`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        senderType: "USER",
        senderId: creatorId,
        addUserId: inviteeId,
        removeBandId: band2Id,
        name: "Houston 3/26 Show"
      })

    console.log(res.body)
    expect(res.status).toBe(201)

    // name updated
    expect(res.body.name).toBe("Houston 3/26 Show")

    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: testConversationId4 }
    })

    expect(updatedConversation?.name).toBe("Houston 3/26 Show")

    // user invite created
    const userInvite = await prisma.conversationInvite.findFirst({
      where: {
        conversationId: testConversationId4,
        recipientUserId: inviteeId,
        status: "PENDING"
      }
    })

    expect(userInvite).toBeDefined()
    const secondUserInviteId = userInvite!.id

    const inviteRespondRes = await request(app)
      .post(`/conversations/conversation-invites/${secondUserInviteId}/respond`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        participantType: "USER",
        participantId: inviteeId,
        action: "ACCEPT"
      })
    console.log(inviteRespondRes.error)
    expect(inviteRespondRes.status).toBe(200);

    // verify invite status updated
    const updatedInvite = await prisma.conversationInvite.findUnique({
      where: { id: secondUserInviteId }
    });
    expect(updatedInvite?.status).toBe("ACCEPTED");

    // verify user is now a participant
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: testConversationId4 }
    });
    const participantUserIds = participants.map(p => p.userId);
    expect(participantUserIds).toContain(inviteeId);

    expect(userInvite).toBeDefined()

    // band removed
    const removedBandParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: testConversationId4,
        bandId: band2Id
      }
    })

    expect(removedBandParticipant).toBeNull()
  })

  // GET
  it("Should get all conversations for a user", async () => {
    const res = await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        senderType: "USER",
        senderId: creatorId
      })

    console.log(res.body)
    expect(res.status).toBe(201)
  })
  it("Should get all conversations for a band", async () => {
    const res = await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        senderType: "BAND",
        senderId: band1Id
      })

    console.log(res.body)
    expect(res.status).toBe(201)
  })
  it("Should get all conversations for a venue", async () => {
    const res = await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({
        senderType: "VENUE",
        senderId: venue1Id
      })

    console.log(res.body)
    expect(res.status).toBe(201)
  })

  // DELETE
  it("Should let user leave conversation", async () => {
    const res = await request(app)
      .delete(`/conversations/${testConversationId4}`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        senderType: "USER",
        senderId: creatorId
      })
    expect(res.status).toBe(200)

    expect(res.body.message).toBe("Left conversation");

    const conversationRes = await request(app)
      .get(`/conversations/${testConversationId4}`)
      .send({
        senderType: "USER",
        senderId: inviteeId
      })
      .set("Authorization", `Bearer ${inviteeToken}`);

    expect(conversationRes.status).toBe(200);

    const participantUserIds = conversationRes.body.participants.map((p: any) => p.userId);
    expect(participantUserIds).not.toContain(creatorId);

    console.log("Remaining participants:", participantUserIds);

  })
})