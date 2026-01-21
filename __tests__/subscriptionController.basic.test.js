jest.mock("stripe");

const {
  getAllSubscriptions,
  getSubscriptionDetails,
  getPaymentHistory,
} = require("../controllers/subscriptionsController");

const Subscriptions = require("../models/Subscriptions");
jest.mock("../models/Subscriptions");

// import stripe mock exports
const {
  mockSubscriptionsRetrieve,
  mockSubscriptionsList,
  mockChargesList,
} = require("../__mocks__/stripe");

describe("Subscription Controller – Phase 1", () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
  });

  // GET ALL SUBSCRIPTIONS
  it("should return subscriptions sorted by latest update", async () => {
    const mockSubs = [
      { _id: "1", updatedAt: new Date("2024-01-10") },
      { _id: "2", updatedAt: new Date("2024-02-01") },
    ];

    Subscriptions.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockSubs),
    });

    await getAllSubscriptions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockSubs);
  });

  it("should return 404 if no subscriptions found", async () => {
    Subscriptions.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });

    await getAllSubscriptions(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "No Subscriptions found",
    });
  });

  // GET SUBSCRIPTION DETAILS
  it("should return merged Stripe + DB subscription details", async () => {
    req.params = { subscriptionId: "sub_123" };

    mockSubscriptionsRetrieve.mockResolvedValue({
      id: "sub_123",
      status: "active",
    });

    Subscriptions.findOne.mockResolvedValue({
      subscriptionId: "sub_123",
      customerId: "cus_1",
    });

    await getSubscriptionDetails(req, res);

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_123");
    expect(res.json).toHaveBeenCalledWith({
      stripe: { id: "sub_123", status: "active" },
      database: { subscriptionId: "sub_123", customerId: "cus_1" },
    });
  });

  it("should return 500 if Stripe retrieval fails", async () => {
    req.params = { subscriptionId: "sub_123" };

    mockSubscriptionsRetrieve.mockRejectedValue(new Error("Stripe error"));

    await getSubscriptionDetails(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Stripe error" });
  });

  // GET PAYMENT HISTORY
  it("should return latest Stripe charges", async () => {
    req.params = { customerId: "cus_123" };

    mockChargesList.mockResolvedValue({
      data: [{ id: "ch_1" }, { id: "ch_2" }],
    });

    await getPaymentHistory(req, res);

    expect(mockChargesList).toHaveBeenCalledWith({
      customer: "cus_123",
      limit: 20,
    });

    expect(res.json).toHaveBeenCalledWith({
      charges: [{ id: "ch_1" }, { id: "ch_2" }],
    });
  });

  it("should return 500 if charge retrieval fails", async () => {
    req.params = { customerId: "cus_123" };

    mockChargesList.mockRejectedValue(new Error("Failed"));

    await getPaymentHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed" });
  });
});
