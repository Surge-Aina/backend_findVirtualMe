const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const User = require("../../../shared/models/User");
const adminRoutes = require("../admin.routes");

const app = express();
app.use(express.json());
app.use("/api/admin", adminRoutes);

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

async function createUser(role, extra = {}) {
  return User.create({
    email: `user_${Date.now()}_${Math.random()}@example.com`,
    username: `user_${Date.now()}_${Math.random()}`,
    password: await bcrypt.hash("password123", 10),
    userKey: `key_${Date.now()}_${Math.random()}`,
    practiceId: `practice_${Date.now()}_${Math.random()}`,
    role,
    ...extra,
  });
}

describe("PATCH /api/admin/users/:id/comped", () => {
  let adminUser;
  let targetUser;
  let customerUser;
  let adminToken;
  let customerToken;

  beforeEach(async () => {
    adminUser = await createUser("admin");
    customerUser = await createUser("customer");
    targetUser = await createUser("customer");
    adminToken = signToken(adminUser);
    customerToken = signToken(customerUser);
  });

  it("allows admin to set comped plan", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const res = await request(app)
      .patch(`/api/admin/users/${targetUser._id}/comped`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ comped: true, compedPlan: "pro" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: String(targetUser._id),
      comped: true,
      compedPlan: "pro",
    });

    const auditLine = logSpy.mock.calls.flat().join(" ");
    expect(auditLine).toContain(`userId=${String(targetUser._id)}`);
    expect(auditLine).not.toContain(targetUser.email);
    logSpy.mockRestore();

    const refreshed = await User.findById(targetUser._id).lean();
    expect(refreshed.comped).toBe(true);
    expect(refreshed.compedPlan).toBe("pro");
  });

  it("rejects non-admin callers", async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${targetUser._id}/comped`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ comped: true, compedPlan: "basic" });

    expect(res.status).toBe(403);
  });

  it("validates compedPlan", async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${targetUser._id}/comped`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ comped: true, compedPlan: "enterprise" });

    expect(res.status).toBe(400);
  });

  it("clears compedPlan when comped is false", async () => {
    await User.updateOne(
      { _id: targetUser._id },
      { $set: { comped: true, compedPlan: "basic" } }
    );

    const res = await request(app)
      .patch(`/api/admin/users/${targetUser._id}/comped`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ comped: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ comped: false, compedPlan: null });
  });
});