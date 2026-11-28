process.env.STRIPE_MODE = "test";
process.env.STRIPE_SECRET_KEY_TEST = "sk_test_synthetic_only";
process.env.FRONTEND_URL = "http://localhost:5173";

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: jest.fn() } },
  }))
);

jest.mock("../services/pricing.service", () => ({
  checkDomainAndGetPrice: jest.fn().mockResolvedValue({
    available: true,
    totalPrice: 12,
  }),
}));

const express = require("express");
const request = require("supertest");
const rejectComped = require("../../../../shared/middleware/rejectComped");
const stripeController = require("../stripe/stripe.controller");

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/payments/checkout",
    (req, _res, next) => {
      req.user = user;
      next();
    },
    rejectComped,
    stripeController.createCheckoutSession
  );
  return app;
}

describe("comped domain checkout guard", () => {
  it("blocks POST /api/payments/checkout for comped users", async () => {
    const res = await request(
      buildApp({
        _id: "507f1f77bcf86cd799439011",
        id: "507f1f77bcf86cd799439011",
        email: "comped@example.com",
        comped: true,
      })
    )
      .post("/api/payments/checkout")
      .send({ domain: "example.com" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      code: "COMPED_ACCOUNT",
      message: "Comped accounts cannot use billing",
    });
  });
});