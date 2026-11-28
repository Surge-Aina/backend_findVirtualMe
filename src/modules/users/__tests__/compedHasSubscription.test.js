const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const User = require("../../../shared/models/User");
const userRoutes = require("../users.routes");

const app = express();
app.use(express.json());
app.use("/api/users", userRoutes);

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("GET /api/users/has-subscription comped accounts", () => {
  it("reports subscription for comped pro without copying Stripe ids", async () => {
    const user = await User.create({
      email: `comped_hs_${Date.now()}@example.com`,
      username: `comped_hs_${Date.now()}`,
      password: await bcrypt.hash("password123", 10),
      userKey: `key_${Date.now()}`,
      practiceId: `practice_${Date.now()}`,
      role: "customer",
      comped: true,
      compedPlan: "pro",
    });

    const token = signToken(user);
    const res = await request(app)
      .get("/api/users/has-subscription")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.hasSubscription).toBe(true);

    const refreshed = await User.findById(user._id).lean();
    expect(refreshed.stripeCustomerId).toBeUndefined();
    expect(refreshed.stripeSubscriptionId).toBeUndefined();
  });

  it("reports no subscription for comped manual-only accounts", async () => {
    const user = await User.create({
      email: `comped_manual_${Date.now()}@example.com`,
      username: `comped_manual_${Date.now()}`,
      password: await bcrypt.hash("password123", 10),
      userKey: `key_${Date.now()}`,
      practiceId: `practice_${Date.now()}`,
      role: "customer",
      comped: true,
      compedPlan: null,
    });

    const token = signToken(user);
    const res = await request(app)
      .get("/api/users/has-subscription")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.hasSubscription).toBe(false);
  });
});