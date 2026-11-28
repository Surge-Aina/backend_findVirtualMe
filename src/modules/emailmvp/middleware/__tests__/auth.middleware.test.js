const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { authRequired } = require("../auth.middleware");

const app = express();
app.get("/protected", authRequired, (_req, res) => {
  res.json({ ok: true });
});

describe("emailmvp authRequired", () => {
  it("rejects super_admin JWTs with 403", async () => {
    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439099", kind: "super_admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("allows a normal user token", async () => {
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", email: "user@example.test" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});