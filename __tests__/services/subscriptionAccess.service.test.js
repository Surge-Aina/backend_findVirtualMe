process.env.STRIPE_SECRET_KEY_TEST = "sk_test_fake";

const mockStripeSubsList = jest.fn();

jest.mock("stripe", () => {
  return jest.fn(() => ({
    subscriptions: { list: mockStripeSubsList },
  }));
});

const {
  getActiveSubscriptionForUser,
  getAiEditingAccess,
  consumeAiEditCredit,
} = require("../../services/subscriptionAccess.service");
const Subscriptions = require("../../models/Subscriptions");
const User = require("../../models/User");

jest.mock("../../models/Subscriptions");
jest.mock("../../models/User");

function createMockQuery(result) {
  return {
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe("subscriptionAccess.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("matches subscriptions by email case-insensitively", async () => {
    const subscription = {
      customerId: "cus_pro_1",
      subscriptionType: "pro",
      status: "active",
    };
    Subscriptions.findOne.mockReturnValue(createMockQuery(subscription));

    const result = await getActiveSubscriptionForUser({
      email: "Paid.User@Example.com",
    });

    expect(Subscriptions.findOne).toHaveBeenCalledWith({
      email: { $regex: "^Paid\\.User@Example\\.com$", $options: "i" },
      status: { $in: ["active", "trialing"] },
    });
    expect(result).toEqual(subscription);
  });

  it("falls back to stripeCustomerId in MongoDB when email lookup misses", async () => {
    const subscription = {
      customerId: "cus_pro_2",
      subscriptionType: "pro",
      status: "active",
    };

    Subscriptions.findOne
      .mockReturnValueOnce(createMockQuery(null))
      .mockReturnValueOnce(createMockQuery(subscription));

    const result = await getAiEditingAccess({
      email: "app-email@example.com",
      stripeCustomerId: "cus_pro_2",
    });

    expect(Subscriptions.findOne).toHaveBeenNthCalledWith(1, {
      email: { $regex: "^app-email@example\\.com$", $options: "i" },
      status: { $in: ["active", "trialing"] },
    });
    expect(Subscriptions.findOne).toHaveBeenNthCalledWith(2, {
      customerId: "cus_pro_2",
      status: { $in: ["active", "trialing"] },
    });
    expect(result).toMatchObject({
      hasAccess: true,
      subscription,
      usage: {
        used: 0,
        limit: 60,
        remaining: 60,
      },
    });
  });

  it("falls back to Stripe API when MongoDB has no record at all", async () => {
    Subscriptions.findOne
      .mockReturnValueOnce(createMockQuery(null))
      .mockReturnValueOnce(createMockQuery(null));

    mockStripeSubsList.mockResolvedValue({
      data: [
        {
          id: "sub_live_1",
          status: "active",
          items: { data: [{ price: { id: "price_test_pro" } }] },
        },
      ],
    });

    const result = await getAiEditingAccess({
      email: "user-no-mongo@example.com",
      stripeCustomerId: "cus_no_mongo",
    });

    expect(result.hasAccess).toBe(true);
    expect(result.subscription).toMatchObject({
      customerId: "cus_no_mongo",
      subscriptionId: "sub_live_1",
      status: "active",
      _fromStripeApi: true,
    });
  });

  it("uses stripeCustomerId fallback when consuming AI edit credits", async () => {
    const user = {
      _id: "user_123",
      email: "app-email@example.com",
      stripeCustomerId: "cus_pro_3",
      aiUsage: {},
    };
    const subscription = {
      customerId: "cus_pro_3",
      subscriptionType: "pro",
      status: "active",
    };

    User.findById.mockResolvedValue(user);
    User.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    Subscriptions.findOne
      .mockReturnValueOnce(createMockQuery(null))
      .mockReturnValueOnce(createMockQuery(subscription));

    const result = await consumeAiEditCredit("user_123");

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: "user_123" },
      { $set: { aiUsage: expect.objectContaining({ agentEdits: expect.objectContaining({ used: 1 }) }) } }
    );
    expect(result).toMatchObject({
      hasAccess: true,
      subscription,
      usage: {
        used: 1,
        limit: 60,
        remaining: 59,
      },
    });
  });
});
