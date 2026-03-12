import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let userId: string
let userToken: string
let otherUserId: string
let otherUserToken: string
let user3Id: string
let user3Token: string
let band2Id: string
let venueUserId: string
let venueUserToken: string
let testVenueId: string
let bandId: string
let otherBandId: string
let showId: string
let tourId: string
let bandInviteId: string
let venueInviteId: string

beforeAll(async () => {
  await prisma.$transaction([
    prisma.showInvite.deleteMany(),
    prisma.showBand.deleteMany(),
    prisma.show.deleteMany(),
    prisma.venueRepresentative.deleteMany(),
    prisma.venue.deleteMany(),
    prisma.bandMember.deleteMany(),
    prisma.band.deleteMany(),
    prisma.tour.deleteMany(),
    prisma.user.deleteMany()
  ])

  // Create main user and band
  const userRes = await request(app)
    .post('/auth/register')
    .send({
      email: "user@test.com",
      password: "password",
      username: "adharsh",
      name: "Adharsh"
    })
  userId = userRes.body.id
  userToken = userRes.body.token

  const bandRes = await request(app)
    .post('/bands')
    .send({
      name: "Heel",
      genre: "Shoegaze",
      city: "College Station",
      state: "Texas",
      country: "USA",
      members: [{ userId: userId }]
    })
    .set("Authorization", `Bearer ${userToken}`);
  bandId = bandRes.body.id

  // Create another user and band for invites
  const otherUserRes = await request(app)
    .post('/auth/register')
    .send({
      email: "user2@test",
      password: "password",
      username: "tayla",
      name: "Tayla"
    })
  otherUserId = otherUserRes.body.id
  otherUserToken = otherUserRes.body.token

  const otherBandRes = await request(app)
    .post('/bands')
    .send({
      name: "Toe",
      genre: "Indie",
      city: "Houston",
      state: "Texas",
      country: "USA",
      members: [{ userId: otherUserId }]
    })
    .set("Authorization", `Bearer ${otherUserToken}`);
  otherBandId = otherBandRes.body.id

  // Create another user and band for invites
  const user3Res = await request(app)
    .post('/auth/register')
    .send({
      email: "user3@test",
      password: "pass",
      username: "andres",
      name: "Andres"
    })
  user3Id = user3Res.body.id
  user3Token = user3Res.body.token

  const band2Res = await request(app)
    .post('/bands')
    .send({
      name: "Foot",
      genre: "J-Pop",
      city: "Katy",
      state: "Texas",
      country: "USA",
      members: [{ userId: user3Id }]
    })
    .set("Authorization", `Bearer ${user3Token}`);
  band2Id = band2Res.body.id

  // Create venue user and venue for invites
  const venueUserRes = await request(app)
    .post('/auth/register')
    .send({
      email: "venue@test",
      password: "password",
      username: "nick",
      name: "Nick"
    })
  venueUserId = venueUserRes.body.id
  venueUserToken = venueUserRes.body.token

  const venueRes = await request(app)
    .post('/venues')
    .send({
      name: "The 101",
      city: "College Station",
      state: "Texas",
      country: "USA"
    })
    .set("Authorization", `Bearer ${venueUserToken}`)
  testVenueId = venueRes.body.id

  // Create a tour
  const tour = await prisma.tour.create({ data: { name: "Spring 2026" } })
  tourId = tour.id
})

afterAll(async () => {
  await prisma.$transaction([
    prisma.showInvite.deleteMany(),
    prisma.showBand.deleteMany(),
    prisma.show.deleteMany(),
    prisma.venueRepresentative.deleteMany(),
    prisma.venue.deleteMany(),
    prisma.bandMember.deleteMany(),
    prisma.band.deleteMany(),
    prisma.tour.deleteMany(),
    prisma.user.deleteMany()
  ])

  await prisma.$disconnect()
})

describe("Show API", () => {

  // CREATE
  it("Should create a show with creator band, sending invite to other band", async () => {
    const res = await request(app)
      .post("/shows")
      .send({
        date: "2026-04-05",
        city: "Austin",
        state: "Texas",
        country: "United States",
        tourId,
        venueId: testVenueId,
        bandIds: [bandId, otherBandId],
        creatorBandId: bandId
      })
      .set("Authorization", `Bearer ${userToken}`)

    console.log(res.body)
    expect(res.status).toBe(201)
    showId = res.body.id
    expect(showId).toBeDefined()

    // Creator band automatically added
    const bandIdsAdded = res.body.bands.map((b: any) => b.bandId)
    expect(bandIdsAdded).toContain(bandId)

    // Other band should receive invite
    const inviteIds = res.body.showInvites.map((i: any) => i.bandId)
    expect(inviteIds).toContain(otherBandId)

    // Venue should receive invite
    const venueInviteIdCheck = res.body.showInvites.find((i: any) => i.venueId === testVenueId)
    expect(venueInviteIdCheck).toBeDefined()

    const bandInvite = await prisma.showInvite.findFirst({
      where: {
        bandId: otherBandId,
        showId: showId
      }
    })

    expect(bandInvite).toBeDefined()

    bandInviteId = bandInvite!.id

    const venueInvite = await prisma.showInvite.findFirst({
      where: {
        venueId: testVenueId,
        showId: showId
      }
    })

    expect(venueInvite).toBeDefined()

    venueInviteId = venueInvite!.id

    console.log(res.body)
  })
  it("Should allow band to accept show invite", async () => {
    const res = await request(app)
      .post(`/bands/shows/invites/${bandInviteId}/respond`)
      .send({ action: "ACCEPT" })
      .set('Authorization', `Bearer ${otherUserToken}`)

    expect(res.status).toBe(200)
    console.log(res.body)

    // Invite status should be ACCEPTED
    const invite = await prisma.showInvite.findUnique({
      where: { id: bandInviteId }
    })

    expect(invite).toBeDefined()
    expect(invite?.status).toBe("ACCEPTED")

    // Band should now be attached to the show
    const showBand = await prisma.showBand.findUnique({
      where: {
        bandId_showId: {
          bandId: otherBandId,
          showId: showId
        }
      }
    })

    expect(showBand).toBeDefined()
  })
  it("Should allow venue to accept show invite", async () => {
    const res = await request(app)
      .post(`/venues/shows/invites/${venueInviteId}/respond`)
      .send({ action: "ACCEPT" })
      .set("Authorization", `Bearer ${venueUserToken}`)

    expect(res.status).toBe(200)
    console.log(res.body)

    // Invite status should be ACCEPTED
    const invite = await prisma.showInvite.findUnique({
      where: { id: venueInviteId }
    })

    expect(invite).toBeDefined()
    expect(invite?.status).toBe("ACCEPTED")

    // Venue should now be attaced to the show
    const show = await prisma.show.findUnique({
      where: { id: showId }
    })

    expect(show).toBeDefined()
    expect(show?.venueId).toBe(testVenueId)
  })

  // READ ALL
  it("Should get all shows", async () => {
    const res = await request(app).get("/shows")
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
  })

  // READ ONE
  it("Should get a valid show by ID", async () => {
    const res = await request(app).get(`/shows/${showId}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(showId)
  })

  // UPDATE
  it("Should update show city, send invite to band, and remove band", async () => {
    const res = await request(app)
      .put(`/shows/${showId}`)
      .send({
        city: "Dallas",
        addBandId: band2Id,
        removeBandId: otherBandId
      })
      .set("Authorization", `Bearer ${userToken}`)

    console.log(res.body)
    expect(res.status).toBe(200)
    expect(res.body.city).toBe("Dallas")

    // Check that a show invite was created for band2Id
    const newInvite = await prisma.showInvite.findFirst({
      where: { showId, bandId: band2Id, status: "PENDING" }
    })
    expect(newInvite).toBeDefined()

    // Check that otherBandId was removed from the show
    const showBands = await prisma.showBand.findMany({
      where: { showId }
    })
    const bandIds = showBands.map(b => b.bandId)
    expect(bandIds).not.toContain(otherBandId)

  })

  // DELETE
  it("Should soft delete a show", async () => {
    const res = await request(app)
      .delete(`/shows/${showId}`)
      .set("Authorization", `Bearer ${userToken}`)

    expect(res.status).toBe(200)

    const getRes = await request(app).get(`/shows/${showId}`)
    expect(getRes.status).toBe(404)
  })

})