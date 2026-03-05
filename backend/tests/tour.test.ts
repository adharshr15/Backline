import request from "supertest"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"

let userId: string
let bandId: string
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
      email: "touruser@test.com",
      password: "password",
      username: "touruser",
      name: "Tour User",
      role: "USER"
    }
  })

  userId = user.id

  const band = await prisma.band.create({
    data: {
      name: "Test Band",
      members: {
        create: {
          userId,
          role: "MANAGER"
        }
      }
    }
  })

  bandId = band.id
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

describe("Tour API", () => {

  // CREATE
  it("Should create a tour", async () => {
    const res = await request(app)
      .post("/tours")
      .send({
        name: "Spring Tour",
        bandIds: [bandId]
      })

    expect(res.status).toBe(201)

    tourId = res.body.id
    expect(tourId).toBeDefined()
    expect(res.body.name).toBe("Spring Tour")

    const bandIds = res.body.bands.map((b: any) => b.bandId)
    expect(bandIds).toContain(bandId)
    console.log(res.body)
  })

  // READ
  it("Should get all tours", async () => {
    const res = await request(app).get("/tours")

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
  })
  it("Should get a valid tour", async () => {
    const res = await request(app).get(`/tours/${tourId}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(tourId)
    console.log(res.body)
  })

  // UPDATE
  it("Should update tour name and add band to tour", async () => {
    const res = await request(app)
      .put(`/tours/${tourId}`)
      .send({
        name: "Updated Tour Name"
      })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe("Updated Tour Name")
    console.log(res.body)
  })

  // DELETE
  it("Should soft delete a tour", async () => {
    const res = await request(app)
      .delete(`/tours/${tourId}`)

    expect(res.status).toBe(200)

    const getRes = await request(app).get(`/tours/${tourId}`)
    expect(getRes.status).toBe(404)
  })

})