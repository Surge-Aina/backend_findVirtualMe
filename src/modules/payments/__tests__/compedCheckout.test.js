process.env.STRIPE_MODE = "test";
process.env.STRIPE_SECRET_KEY_TEST = "sk_test_synthetic_only";
process.env.PRICE_BASIC_TEST = "price_basic_test";
process.env.PRICE_PRO_TEST = "price_pro_test";
process.env.FRONTEND_URL = "http://localhost:5173";

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    prices: { retrieve: jest.fn() },
    paymentIntents: { create: jest.fn() },
    customers: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
  }))
);

jest.mock("../../../shared/models/User", () => ({
  updateOne: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const checkoutRoutes = require("../checkout.routes");

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use("/checkout", checkoutRoutes);
  return app;
}

describe("comped checkout billing guard", () => {
  const compedUser = {
    _id: "507f1f77bcf86cd799439011",
    email: "comped@example.com",
    role: "customer",
    comped: true,
    compedPlan: "pro",
  };

  it("blocks checkout session for comped accounts", async () => {
    const res = await request(buildApp(compedUser))
      .post("/checkout/session")
      .send({ plan: "basic" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      code: "COMPED_ACCOUNT",
      message: "Comped accounts cannot use billing",
    });
  });

  it("blocks create-customer for comped accounts", async () => {
    const res = await request(buildApp(compedUser)).post("/checkout/create-customer");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPED_ACCOUNT");
  });

  it("blocks billing portal session for comped accounts", async () => {
    const res = await request(buildApp({
      ...compedUser,
      stripeCustomerId: "cus_should_not_matter",
    })).post("/checkout/billing-session");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPED_ACCOUNT");
  });
});