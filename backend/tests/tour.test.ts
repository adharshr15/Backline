import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let user1Id: string
let user1Token: string
let band1Id: string
let user2Id: string
let user2Token: string
let band2Id: string
let user3Id: string
let user3Token: string
let band3Id: string
let show1Id: string
let show2Id: string

let tourId: string
let tourInviteId: string

beforeAll(async () => {
  await prisma.$transaction([
    prisma.tourInvite.deleteMany(),
    prisma.showInvite.deleteMany(),
    prisma.showBand.deleteMany(),
    prisma.show.deleteMany(),
    prisma.venueRepresentative.deleteMany(),
    prisma.venue.deleteMany(),
    prisma.bandMember.deleteMany(),
    prisma.bandTour.deleteMany(),
    prisma.band.deleteMany(),
    prisma.tour.deleteMany(),
    prisma.user.deleteMany()
  ])

  const user1Res = await request(app)
    .post('/auth/register')
    .send({
      email: "user@test",
      password: "pass",
      username: "adharsh",
      name: "Adharsh"
    })

  user1Id = user1Res.body.id
  user1Token = user1Res.body.token

  const band1Res = await request(app)
    .post('/bands')
    .send({
      name: "Heel",
      genre: "Shoegaze",
      city: "College Station",
      state: "Texas",
      country: "USA",
      members: [{ userId: user1Id }]
    })
    .set("Authorization", `Bearer ${user1Token}`);

  band1Id = band1Res.body.id

  const user2Res = await request(app)
    .post('/auth/register')
    .send({
      email: "user2@test",
      password: "pass",
      username: "tayla",
      name: "Tayla"
    })

  user2Id = user2Res.body.id
  user2Token = user2Res.body.token

  const band2Res = await request(app)
    .post('/bands')
    .send({
      name: "Toe",
      genre: "Shoegaze",
      city: "College Station",
      state: "Texas",
      country: "USA",
      members: [{ userId: user2Id }]
    })
    .set("Authorization", `Bearer ${user2Token}`);

  band2Id = band2Res.body.id

  const user3Res = await request(app)
    .post('/auth/register')
    .send({
      email: "user3@test",
      password: "pass",
      username: "nick",
      name: "Nick"
    })

  user3Id = user3Res.body.id
  user3Token = user3Res.body.token

  const band3Res = await request(app)
    .post('/bands')
    .send({
      name: "Foot",
      genre: "Shoegaze",
      city: "College Station",
      state: "Texas",
      country: "USA",
      members: [{ userId: user3Id }]
    })
    .set("Authorization", `Bearer ${user3Token}`);

  band3Id = band3Res.body.id

  const show1Res = await request(app)
    .post('/shows')
    .send({
      date: "2026-04-05",
        city: "Austin",
        state: "Texas",
        country: "United States",
        tourId,
        venueName: "The 101",
        bandIds: [band1Id, band2Id],
        creatorBandId: band1Id
    })
    .set("Authorization", `Bearer ${user1Token}`)
  
  show1Id = show1Res.body.id

  const show2Res = await request(app)
    .post('/shows')
    .send({
      date: "2026-04-06",
        city: "Houston",
        state: "Texas",
        country: "United States",
        tourId,
        venueName: "The Venue",
        bandIds: [band1Id, band2Id],
        creatorBandId: band2Id
    })
    .set("Authorization", `Bearer ${user2Token}`)
  
  show2Id = show2Res.body.id
})

afterAll(async () => {

  await prisma.$transaction([
    prisma.tourInvite.deleteMany(),
    prisma.showInvite.deleteMany(),
    prisma.showBand.deleteMany(),
    prisma.show.deleteMany(),
    prisma.venueRepresentative.deleteMany(),
    prisma.venue.deleteMany(),
    prisma.bandMember.deleteMany(),
    prisma.bandTour.deleteMany(),
    prisma.band.deleteMany(),
    prisma.tour.deleteMany(),
    prisma.user.deleteMany()
  ])

  await prisma.$disconnect()
})

describe("Tour API", () => {

  // CREATE
  it("Should create a tour with creator band, sending invite to other band", async () => {
    const res = await request(app)
      .post('/tours')
      .send({
        name: "Spring 2026",
        bandIds: [band1Id, band2Id], 
        creatorBandId: band1Id
      })
      .set("Authorization", `Bearer ${user1Token}`)
    
    console.log(res.error)
    expect(res.status).toBe(201)
    tourId = res.body.id
    expect(tourId).toBeDefined()

    // Creator band added
    const bandIdsAdded = res.body.bands.map((b: any) => b.bandId)
    expect(bandIdsAdded).toContain(band1Id)
    
    // Other band should receive invite
    const inviteIds = res.body.tourInvites.map((i: any) => i.bandId)
    expect(inviteIds).toContain(band2Id)

    const tourInvite = await prisma.tourInvite.findFirst({
      where: {
        bandId: band2Id,
        tourId: tourId
      }
    })
    expect(tourInvite).toBeDefined()

    tourInviteId = tourInvite!.id

  })
  it("Should allow band to accept tour invite", async () => {
    const res = await request(app)
      .post(`/bands/tours/invites/${tourInviteId}/respond`)
      .send(({ action: "ACCEPT" } ))
      .set('Authorization', `Bearer ${user2Token}`)
    
      expect(res.status).toBe(200)
      console.log(res.body)

      const invite = await prisma.tourInvite.findUnique({
        where: { id: tourInviteId }
      })

      expect(invite).toBeDefined()
      expect(invite?.status).toBe("ACCEPTED")

      // Band should now be attached to tour
      const tourBand = await prisma.bandTour.findUnique({
        where: {
          bandId_tourId: {
            bandId: band2Id,
            tourId: tourId
          }
        }
      })

      expect(tourBand).toBeDefined()
  })
  
  // READ
  it("Should get all tours", async () => {
    const res = await request(app).get("/tours")

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
  })
  it("Should get a valid show by ID", async () => {
    const res = await request(app).get(`/tours/${tourId}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(tourId)
  })

  // UPDATE
  it("Should update tour name, send invite to band, and remove band", async () => {
    const res = await request(app)
      .put(`/tours/${tourId}`)
      .send({
        name: "Spring 2026 REAL", 
        addBandId: band3Id,
        removeBandId: band2Id
      })
      .set("Authorization", `Bearer ${user1Token}`)
    
    console.log(res.body)
    expect(res.status).toBe(200)
    expect(res.body.name).toBe("Spring 2026 REAL")

    // check that tour invite was created for band 3
    const newInvite = await prisma.tourInvite.findFirst({
      where: { tourId, bandId: band3Id, status: "PENDING" }
    })
    expect(newInvite).toBeDefined()

    // check that band 2 was removed from tour
    const tourBands = await prisma.bandTour.findMany({
      where: { tourId }
    })
    const bandIds = tourBands.map(b => b.bandId)
    expect(bandIds).not.toContain(band2Id)
  })

  // DELETE 
  it("Should soft delete a show", async () => {
    const res = await request(app)
      .delete(`/tours/${tourId}`)
      .set("Authorization", `Bearer ${user1Token}`)

    expect(res.status).toBe(200)

    const getRes = await request(app).get(`/tours/${tourId}`)
    expect(getRes.status).toBe(404)
  })

})