process.env.STRIPE_SECRET_KEY_TEST = "sk_test_fake";

jest.mock("stripe", () => jest.fn(() => ({ subscriptions: { list: jest.fn() } })));
jest.mock("../../../shared/models/Subscriptions");

const {
  getAiEditingAccess,
  DEFAULT_AGENT_EDIT_LIMIT,
  PRO_AGENT_EDIT_LIMIT,
} = require("../subscription-access.service");

describe("subscriptionAccess comped accounts", () => {
  it("grants AI access for comped pro without Stripe lookup", async () => {
    const result = await getAiEditingAccess({
      email: "comped-pro@example.com",
      comped: true,
      compedPlan: "pro",
    });

    expect(result.hasAccess).toBe(true);
    expect(result.subscription).toMatchObject({
      subscriptionType: "pro",
      status: "active",
      _comped: true,
    });
    expect(result.usage.limit).toBe(PRO_AGENT_EDIT_LIMIT);
  });

  it("grants AI access for comped basic with basic quota", async () => {
    const result = await getAiEditingAccess({
      email: "comped-basic@example.com",
      comped: true,
      compedPlan: "basic",
    });

    expect(result.hasAccess).toBe(true);
    expect(result.usage.limit).toBe(DEFAULT_AGENT_EDIT_LIMIT);
  });

  it("denies AI access when compedPlan is null", async () => {
    const result = await getAiEditingAccess({
      email: "comped-manual@example.com",
      comped: true,
      compedPlan: null,
    });

    expect(result.hasAccess).toBe(false);
    expect(result.subscription).toBeNull();
    expect(result.usage.limit).toBe(0);
  });
});