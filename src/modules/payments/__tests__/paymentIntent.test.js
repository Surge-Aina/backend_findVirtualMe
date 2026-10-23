process.env.STRIPE_MODE = "test";
process.env.STRIPE_SECRET_KEY_TEST = "sk_test_synthetic_only";
process.env.PRICE_BASIC_TEST = "price_basic_test";
process.env.PRICE_PRO_TEST = "price_pro_test";

const mockRetrieve = jest.fn();
const mockCreate = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    prices: { retrieve: (...args) => mockRetrieve(...args) },
    paymentIntents: { create: (...args) => mockCreate(...args) },
    customers: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
  })),
);

const express = require("express");
const request = require("supertest");
const checkoutRoutes = require("../checkout.routes");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { _id: "user-1", email: "buyer@example.com", role: "customer" };
  next();
});
app.use("/checkout", checkoutRoutes);

describe("POST /checkout/payment-intent", () => {
  beforeEach(() => {
    mockRetrieve.mockReset();
    mockCreate.mockReset();
    mockCreate.mockImplementation(async (payload) => ({
      id: "pi_server",
      client_secret: "sec_server",
      amount: payload.amount,
    }));
  });

  test("charges the Stripe price for the plan and ignores the client amount", async () => {
    mockRetrieve.mockResolvedValue({ unit_amount: 900, currency: "usd", active: true });

    const res = await request(app).post("/checkout/payment-intent").send({
      plan: "basic",
      amount: 1,
      userId: "someone-else",
    });

    expect(res.status).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith("price_basic_test");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 900,
        currency: "usd",
        metadata: expect.objectContaining({ appUserId: "user-1", plan: "basic" }),
      }),
    );
    expect(res.body.amount).toBe(900);
    expect(res.body.plan).toBe("basic");
    expect(res.body.clientSecret).toBe("sec_server");
  });

  test("accepts a known price id and still ignores the client amount", async () => {
    mockRetrieve.mockResolvedValue({ unit_amount: 2900, currency: "usd", active: true });

    const res = await request(app).post("/checkout/payment-intent").send({
      priceId: "price_pro_test",
      amount: 999999,
    });

    expect(res.status).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith("price_pro_test");
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 2900 }));
    expect(res.body.plan).toBe("pro");
  });

  test("rejects an unknown plan without creating a payment intent", async () => {
    const res = await request(app).post("/checkout/payment-intent").send({
      plan: "enterprise",
      amount: 5000,
    });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("rejects a whitelisted price that is not an active usd amount", async () => {
    mockRetrieve.mockResolvedValue({ unit_amount: 900, currency: "eur", active: true });

    const res = await request(app).post("/checkout/payment-intent").send({ plan: "basic" });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
