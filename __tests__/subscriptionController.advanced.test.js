// __tests__/subscriptionController.advanced.test.js
require("../setup"); // if you have a global Jest setup, else remove

jest.mock("stripe");
const StripeMock = require("stripe");
const {
  mockSubscriptionsRetrieve,
  mockSubscriptionsUpdate,
  mockSubscriptionsCancel,
  mockSubscriptionsList,
  mockChargesRetrieve,
  mockRefundsCreate,
} = require("stripe");

const Subscriptions = require("../models/Subscriptions");
jest.mock("../models/Subscriptions");

const {
  updateSubsFromStripe,
  reconcileSubscriptions,
  updateSubscription,
  cancelSubscription,
  cancelSubscriptionImmediately,
  reactivateSubscription,
  issueRefund,
} = require("../controllers/subscriptionsController");

// Silence noisy logs
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("Subscription Controller – Advanced flows", () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
    // Ensure constructor used at least once (not strictly needed, but explicit)
    StripeMock.mockClear();
  });

  // ---------------------------
  // updateSubsFromStripe
  // ---------------------------
  it("should update local subs with latest Stripe data", async () => {
    const localSubs = [
      { _id: "mongo1", subscriptionId: "sub_1" },
      { _id: "mongo2", subscriptionId: "sub_2" },
    ];
    Subscriptions.find.mockResolvedValue(localSubs);

    Subscriptions.findByIdAndUpdate.mockImplementation((id, update) =>
      Promise.resolve({ _id: id, ...update })
    );

    mockSubscriptionsRetrieve.mockImplementation(async (subId) => ({
      id: subId,
      status: "active",
      cancel_at_period_end: false,
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      canceled_at: null,
      items: { data: [{ price: { id: "price_basic" } }] },
    }));

    await updateSubsFromStripe(req, res);

    expect(Subscriptions.find).toHaveBeenCalledTimes(1);
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledTimes(2);
    expect(Subscriptions.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);

    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBe(2);
  });

  it("should return 404 if no local subscriptions exist in updateSubsFromStripe", async () => {
    Subscriptions.find.mockResolvedValue([]);

    await updateSubsFromStripe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "No Subscriptions found",
    });
  });

  it("should return 500 if updateSubsFromStripe throws", async () => {
    Subscriptions.find.mockRejectedValue(new Error("DB fail"));

    await updateSubsFromStripe(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });

  // ---------------------------
  // reconcileSubscriptions
  // ---------------------------
  it("should reconcile existing subscriptions and create missing ones", async () => {
    // One existing local subscription matching sub_1
    const existing = [{ _id: "mongo1", subscriptionId: "sub_1" }];
    Subscriptions.find.mockResolvedValue(existing);

    const stripeSubsPage = {
      data: [
        {
          id: "sub_1", // existing
          customer: { id: "cus_1", email: "one@test.com", name: "One" },
          status: "active",
          cancel_at_period_end: false,
          created: 1700000000,
          canceled_at: null,
          items: {
            data: [
              {
                current_period_start: 1700000000,
                current_period_end: 1702592000,
                price: { id: "price_basic", active: true },
                quantity: 1,
              },
            ],
          },
          latest_invoice: {
            id: "in_1",
            payment_intent: { id: "pi_1" },
          },
          default_payment_method: "pm_1",
          discounts: {
            coupon: { id: "coupon_1" },
            end: 1703000000,
          },
        },
        {
          id: "sub_2", // new
          customer: { id: "cus_2", email: "two@test.com", name: "Two" },
          status: "active",
          cancel_at_period_end: false,
          created: 1700001000,
          canceled_at: null,
          items: {
            data: [
              {
                current_period_start: 1700001000,
                current_period_end: 1702593000,
                price: { id: "price_pro", active: true },
                quantity: 1,
              },
            ],
          },
          latest_invoice: {
            id: "in_2",
            payment_intent: { id: "pi_2" },
          },
          default_payment_method: "pm_2",
          discounts: null,
        },
      ],
      has_more: false,
    };

    mockSubscriptionsList.mockResolvedValue(stripeSubsPage);

    Subscriptions.findByIdAndUpdate.mockImplementation((id, update) =>
      Promise.resolve({ _id: id, ...update })
    );
    Subscriptions.create.mockImplementation(async (doc) => ({
      _id: "newMongoId",
      ...doc,
    }));

    await reconcileSubscriptions(req, res);

    expect(Subscriptions.find).toHaveBeenCalledTimes(1);
    expect(mockSubscriptionsList).toHaveBeenCalledTimes(1);

    expect(Subscriptions.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(Subscriptions.create).toHaveBeenCalledTimes(1);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.total_reconciled).toBe(2);
    expect(body.new_records).toBe(1);
  });

  it("should return 500 if reconcileSubscriptions throws", async () => {
    Subscriptions.find.mockRejectedValue(new Error("boom"));

    await reconcileSubscriptions(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toHaveProperty("message");
  });

  // updateSubscription
  it("should return 500 if updateSubscription fails", async () => {
    req.body = { subscriptionId: "sub_123", newPlan: "basic" };

    mockSubscriptionsRetrieve.mockRejectedValue(new Error("Stripe fail"));

    await updateSubscription(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Stripe fail" });
  });

  // cancelSubscription
  it("should mark subscription to cancel at period end", async () => {
    req.body = { subscriptionId: "sub_123" };

    mockSubscriptionsUpdate.mockResolvedValue({
      id: "sub_123",
      cancel_at_period_end: true,
    });

    await cancelSubscription(req, res);

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: true,
    });

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      stripeSubscription: { id: "sub_123", cancel_at_period_end: true },
    });
  });

  it("should return 500 if cancelSubscription fails", async () => {
    req.body = { subscriptionId: "sub_123" };

    mockSubscriptionsUpdate.mockRejectedValue(new Error("Stripe fail"));

    await cancelSubscription(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Stripe fail" });
  });

  // cancelSubscriptionImmediately
  it("should cancel subscription immediately", async () => {
    req.body = { subscriptionId: "sub_123" };

    mockSubscriptionsCancel.mockResolvedValue({
      id: "sub_123",
      status: "canceled",
    });

    await cancelSubscriptionImmediately(req, res);

    expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_123");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      canceledSubscription: { id: "sub_123", status: "canceled" },
    });
  });

  it("should return 500 if cancelSubscriptionImmediately fails", async () => {
    req.body = { subscriptionId: "sub_123" };

    mockSubscriptionsCancel.mockRejectedValue(new Error("Stripe fail"));

    await cancelSubscriptionImmediately(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Stripe fail" });
  });

  // reactivateSubscription
  it("should reactivate subscription by clearing cancel_at_period_end", async () => {
    req.body = { subscriptionId: "sub_123" };

    mockSubscriptionsUpdate.mockResolvedValue({
      id: "sub_123",
      cancel_at_period_end: false,
    });

    await reactivateSubscription(req, res);

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: false,
    });

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      reactivatedSubscription: { id: "sub_123", cancel_at_period_end: false },
    });
  });

  it("should return 500 if reactivateSubscription fails", async () => {
    req.body = { subscriptionId: "sub_123" };

    mockSubscriptionsUpdate.mockRejectedValue(new Error("Stripe fail"));

    await reactivateSubscription(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Stripe fail" });
  });

  it("should refund and cancel subscription immediately for fraudulent reason", async () => {
    req.body = {
      chargeId: "ch_1",
      amount: 1000,
      reason: "fraudulent",
    };

    mockChargesRetrieve.mockResolvedValue({
      id: "ch_1",
      customer: "cus_123",
      invoice: { subscription: "sub_123" },
    });

    mockRefundsCreate.mockResolvedValue({
      id: "re_1",
      amount: 1000,
      currency: "usd",
      reason: "fraudulent",
      status: "succeeded",
    });

    mockSubscriptionsCancel.mockResolvedValue({ id: "sub_123" });
    Subscriptions.findOneAndUpdate.mockResolvedValue({});

    await issueRefund(req, res);

    expect(mockChargesRetrieve).toHaveBeenCalledWith("ch_1", {
      expand: ["invoice"],
    });
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ charge: "ch_1", amount: 1000 })
    );
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_123");
    expect(Subscriptions.findOneAndUpdate).toHaveBeenCalledWith(
      { customerId: "cus_123" },
      expect.objectContaining({
        $push: expect.any(Object),
      })
    );

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.subscriptionCanceled).toBe(true);
    expect(body.subscriptionId).toBe("sub_123");
  });

  it("should pick subscription from list when invoice has no subscription and reason is duplicate", async () => {
    req.body = {
      chargeId: "ch_2",
      amount: 500,
      reason: "duplicate",
    };

    mockChargesRetrieve.mockResolvedValue({
      id: "ch_2",
      customer: "cus_456",
      invoice: null,
    });

    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: "sub_456" }],
    });

    mockRefundsCreate.mockResolvedValue({
      id: "re_2",
      amount: 500,
      currency: "usd",
      reason: "duplicate",
      status: "succeeded",
    });

    Subscriptions.findOneAndUpdate.mockResolvedValue({});

    await issueRefund(req, res);

    expect(mockSubscriptionsCancel).not.toHaveBeenCalled();

    const body = res.json.mock.calls[0][0];
    expect(body.subscriptionCanceled).toBe(false);
    expect(body.subscriptionId).toBe("sub_456");
  });

  it("should return 500 if issueRefund fails", async () => {
    req.body = {
      chargeId: "ch_bad",
      amount: 1000,
      reason: "fraudulent",
    };

    mockChargesRetrieve.mockRejectedValue(new Error("Stripe refund fail"));

    await issueRefund(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Stripe refund fail" });
  });
});
