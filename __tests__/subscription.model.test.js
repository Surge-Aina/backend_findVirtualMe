require("../setup");
const mongoose = require("mongoose");
const Subscription = require("../models/Subscriptions");

beforeAll(async () => {
  await Subscription.ensureIndexes(); // or .syncIndexes()
});

describe("Subscription Model", () => {
  it("should require email, customerId and subscriptionId", async () => {
    const sub = new Subscription({});

    let err;
    try {
      await sub.validate();
    } catch (e) {
      err = e;
    }

    expect(err.errors.email).toBeDefined();
    expect(err.errors.customerId).toBeDefined();
    expect(err.errors.subscriptionId).toBeDefined();
  });

  it("should enforce unique customerId", async () => {
    await Subscription.create({
      email: "a@test.com",
      name: "Test",
      customerId: "cus_123",
      subscriptionId: "sub_123",
    });

    let error;
    try {
      await Subscription.create({
        email: "b@test.com",
        name: "Other",
        customerId: "cus_123", // duplicate
        subscriptionId: "sub_999",
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe(11000);
  });

  it("should reject invalid status enums", async () => {
    const sub = new Subscription({
      email: "bad@test.com",
      name: "Test",
      customerId: "cus_99",
      subscriptionId: "sub_99",
      status: "wrong-status",
    });

    let err;
    try {
      await sub.validate();
    } catch (e) {
      err = e;
    }

    expect(err.errors.status).toBeDefined();
  });

  it("should allow valid Stripe status enums", async () => {
    const validStatuses = [
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ];

    for (const status of validStatuses) {
      const sub = new Subscription({
        email: "v@test.com",
        customerId: "cus_v",
        subscriptionId: "sub_v",
        status,
      });

      let err;
      try {
        await sub.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeUndefined();
    }
  });

  it("should auto populate timestamps", async () => {
    const sub = await Subscription.create({
      email: "time@test.com",
      name: "Time",
      customerId: "cus_time",
      subscriptionId: "sub_time",
    });

    expect(sub.createdAt).toBeDefined();
    expect(sub.updatedAt).toBeDefined();
  });

  it("should default subscriptionItems quantity to 1", async () => {
    const sub = await Subscription.create({
      email: "i@test.com",
      customerId: "cus_i",
      subscriptionId: "sub_i",
      subscriptionItems: [{ itemId: "si_1", priceId: "price_1" }],
    });

    expect(sub.subscriptionItems[0].quantity).toBe(1);
  });

  it("should set default timestamp for paymentLog entries", async () => {
    const sub = await Subscription.create({
      email: "p@test.com",
      customerId: "cus_p",
      subscriptionId: "sub_p",
      paymentLog: [
        {
          paymentIntentId: "pi",
          chargeId: "ch",
          invoiceId: "in",
          amount: 1000,
          currency: "usd",
          confirmed: true,
        },
      ],
    });

    expect(sub.paymentLog[0].timestamp).toBeDefined();
  });

  it("should set default timestamp for refundLog entries", async () => {
    const sub = await Subscription.create({
      email: "r@test.com",
      customerId: "cus_r",
      subscriptionId: "sub_r",
      refundLog: [
        {
          refundId: "re_123",
          chargeId: "ch_123",
          amount: 1000,
          currency: "usd",
          reason: "duplicate",
          status: "succeeded",
        },
      ],
    });

    expect(sub.refundLog[0].timestamp).toBeDefined();
  });

  it("should set default timestamp for modificationLogs entries", async () => {
    const sub = await Subscription.create({
      email: "m@test.com",
      customerId: "cus_m",
      subscriptionId: "sub_m",
      modificationLogs: [
        {
          subscriptionType: "basic",
          status: "active",
          priceId: "price123",
          action: "created",
        },
      ],
    });

    expect(sub.modificationLogs[0].timestamp).toBeDefined();
  });
});
