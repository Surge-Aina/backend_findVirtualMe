const express = require("express");
const request = require("supertest");
const User = require("../../../shared/models/User");
const authRoutes = require("../auth.http.routes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

describe("signup validation", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({ email: "incomplete@example.test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("returns 409 for duplicate username", async () => {
    const username = `dup_${nonce()}`;
    await User.create({
      username,
      email: `first.${nonce()}@example.test`,
      password: "synthetic-password",
      name: "First Example",
    });

    const res = await request(app).post("/api/auth/signup").send({
      name: "Second Example",
      username,
      email: `second.${nonce()}@example.test`,
      password: "synthetic-password",
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Username/i);
  });
});