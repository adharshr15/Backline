// import { describe, it, expect, beforeAll, afterAll } from "vitest"
// import request from "supertest"
// import { app } from "../src/index"
// import { prisma } from "../src/lib/prisma"
// import { BandRole } from "../generated/prisma/client"

// let bandId: string
// let userId1: string
// let userId2: string
// let tourId: string

// describe("Band API", () => {

//   beforeAll(async () => {
//     // Clean test database in correct order
//     await prisma.$transaction([
//       prisma.tourStop.deleteMany(),
//       prisma.tour.deleteMany(),
//       prisma.bandMember.deleteMany(),
//       prisma.band.deleteMany(),
//       prisma.user.deleteMany(),
//     ])

//     // Create test users
//     const user1 = await prisma.user.create({
//       data: {
//         email: "banduser1@test.com",
//         password: "password",
//         username: "banduser1",
//         name: "User One",
//         role: "BAND"
//       }
//     })

//     const user2 = await prisma.user.create({
//       data: {
//         email: "banduser2@test.com",
//         password: "password",
//         username: "banduser2",
//         name: "User Two",
//         role: "BAND"
//       }
//     })

//     userId1 = user1.id
//     userId2 = user2.id
//   })

//   // CREATE
//   it("Should create a band with members and tours", async () => {
//     const res = await request(app)
//       .post("/bands")
//       .send({
//         name: "Test Band",
//         genre: "Rock",
//         location: "Austin",
//         members: [
//           { userId: userId1, role: BandRole.MEMBER },
//           { userId: userId2, role: BandRole.MANAGER }
//         ],
//         tours: [
//           { name: "Summer Tour" }
//         ]
//       })

//     expect(res.status).toBe(201)
//     expect(res.body.name).toBe("Test Band")
//     expect(res.body.members.length).toBe(2)

//     bandId = res.body.id
//   })

//   it("Should get all bands", async () => {
//     const res = await request(app).get("/bands")
//     expect(res.status).toBe(200)
//     expect(res.body.length).toBeGreaterThan(0)
//   })

//   it("Should get band by ID", async () => {
//     const res = await request(app).get(`/bands/${bandId}`)
//     expect(res.status).toBe(200)
//     expect(res.body.id).toBe(bandId)
//   })

//   it("Should update band (add member + update role)", async () => {
//     const res = await request(app)
//       .put(`/bands/${bandId}`)
//       .send({
//         name: "Updated Band",
//         updateRoles: [
//           { userId: userId1, role: BandRole.MANAGER }
//         ]
//       })

//     expect(res.status).toBe(200)
//     expect(res.body.name).toBe("Updated Band")
//   })

//   it("Should delete band", async () => {
//     const res = await request(app)
//       .delete(`/bands/${bandId}`)

//     expect(res.status).toBe(200)
//   })

//   it("Should return 404 after deletion", async () => {
//     const res = await request(app)
//       .get(`/bands/${bandId}`)

//     expect(res.status).toBe(404)
//   })

//   afterAll(async () => {
//     await prisma.$transaction([
//       prisma.tourStop.deleteMany(),
//       prisma.tour.deleteMany(),
//       prisma.bandMember.deleteMany(),
//       prisma.band.deleteMany(),
//       prisma.user.deleteMany(),
//     ])

//     await prisma.$disconnect()
//   })
// })