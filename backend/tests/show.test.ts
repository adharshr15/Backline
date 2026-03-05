import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let userId: string
let bandId: string
let showId: string
let tourId: string

beforeAll(async () => {

  await prisma.$transaction([
    prisma.showBand.deleteMany(),
    prisma.bandTour.deleteMany(),
    prisma.show.deleteMany(),
    prisma.tour.deleteMany(),
    prisma.bandMember.deleteMany(),
    prisma.band.deleteMany(),
    prisma.user.deleteMany()
  ])

  const user = await prisma.user.create({
    data: {
      email: "user@test.com",
      password: "password",
      username: "adharsh",
      name: "Adharsh",
      role: "USER"
    }
  })

  userId = user.id

  const band = await prisma.band.create({
    data: {
      name: "Heel",
      members: {
        create: {
          userId,
          role: "MANAGER"
        }
      }
    }
  })

  bandId = band.id

  const tour = await prisma.tour.create({
    data: {
      name: "Spring 2026"
    }
  })

  tourId = tour.id

})

afterAll(async () => {

  await prisma.$transaction([
    prisma.showBand.deleteMany(),
    prisma.bandTour.deleteMany(),
    prisma.show.deleteMany(),
    prisma.tour.deleteMany(),
    prisma.bandMember.deleteMany(),
    prisma.band.deleteMany(),
    prisma.user.deleteMany()
  ])

  await prisma.$disconnect()
})

describe("Show API", () => {

  // CREATE
  it("Should create a show", async () => {

    const res = await request(app)
      .post("/shows")
      .send({
        date: "2026-04-05",
        city: "Austin",
        state: "Texas",
        country: "United States",
        tourId,
        bandIds: [bandId]
        })
    console.log(res.error)

    expect(res.status).toBe(201)

    showId = res.body.id
    expect(showId).toBeDefined()

    const bandIds = res.body.bands.map((b: any) => b.bandId)
    expect(bandIds).toContain(bandId)
  })

  // READ ALL
  it("Should get all shows", async () => {

    const res = await request(app)
      .get("/shows")

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
  })

  // READ ONE
  it("Should get a valid show", async () => {

    const res = await request(app)
      .get(`/shows/${showId}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(showId)
  })

  // UPDATE
  it("Should update show city", async () => {

    const res = await request(app)
      .put(`/shows/${showId}`)
      .send({
        city: "Dallas"
      })

    expect(res.status).toBe(200)
    expect(res.body.city).toBe("Dallas")
  })

  // DELETE
  it("Should soft delete a show", async () => {

    const res = await request(app)
      .delete(`/shows/${showId}`)

    expect(res.status).toBe(200)

    const getRes = await request(app)
      .get(`/shows/${showId}`)

    expect(getRes.status).toBe(404)
  })

})