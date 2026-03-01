import request from "supertest"
import { describe, it, expect, afterAll } from "vitest"
import { app } from "../src/index"
import { prisma } from "../src/lib/prisma"


afterAll(async () => {
  await prisma.user.deleteMany()
  await prisma.$disconnect()
});

console.log(process.env.DATABASE_URL)

describe("User API", () => {
    let testUserId: string

    // CREATE
    it("Should create a user", async () => {
        const res = await request(app)
            .post("/users")
            .send({
                email: "test@test.com",
                password: "123456",
                username: "tester",
                name: "Tester",
                role: "BAND"
            })

        expect(res.status).toBe(201)
        expect(res.body.email).toBe("test@test.com")

        testUserId = res.body.id;
        expect(testUserId).toBeDefined()
    });

    // READ
    it("Should get all users", async () => {
        const res = await request(app)
            .get("/users")

        expect(res.status).toBe(200)
    });
    it("Should get a valid user", async () => {
        const res = await request(app)
            .get(`/users/${testUserId}`)

        expect(res.status).toBe(200)
    });
    it("Should get an invalid user", async () => {
        const res = await request(app)
            .get("/users/invalid-user-id")

        expect(res.status).toBe(404)
    });

    // UPDATE
    it("Should update a user", async () => {
        const res = await request(app)
            .put(`/users/${testUserId}`)
            .send({
                name: "Updated Tester",
                email: "updated@test.com"
            })

        expect(res.status).toBe(200)
        expect(res.body.name).toBe("Updated Tester")
        expect(res.body.email).toBe("updated@test.com")
    })

    // DELETE
    it("Should delete a user", async () => {
        const res = await request(app)
            .delete(`/users/${testUserId}`)

        expect(res.status).toBe(200)
    })

    // CONFIRM DELETE
    it("Should return 404 after deletion", async () => {
        const res = await request(app).get(`/users/${testUserId}`)
        expect(res.status).toBe(404)
    })
})