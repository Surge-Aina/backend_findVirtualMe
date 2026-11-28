jest.mock("../../payments/subscription-access.service", () => ({
  getActiveSubscriptionForUser: jest.fn(),
}));

const Portfolio = require("../models/Portfolio");
const { getActiveSubscriptionForUser } = require("../../payments/subscription-access.service");
const User = require("../../../shared/models/User");
const { assertCanCreatePortfolio, PlanLimitError } = require("../planLimits.service");
const portfolioService = require("../portfolio.service");

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

describe("planLimits", () => {
  beforeEach(() => {
    getActiveSubscriptionForUser.mockReset();
    getActiveSubscriptionForUser.mockResolvedValue(null);
  });

  it("allows one portfolio on the free plan and blocks a second", async () => {
    const id = nonce();
    const user = await User.create({
      username: `free_${id}`,
      email: `free.${id}@example.test`,
      password: "synthetic-password",
      name: "Free Example",
    });

    await assertCanCreatePortfolio(user._id);
    await portfolioService.createPortfolio(user._id, "agent", { title: "First" });

    await expect(assertCanCreatePortfolio(user._id)).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("allows multiple portfolios when a paid subscription is active", async () => {
    const id = nonce();
    const user = await User.create({
      username: `paid_${id}`,
      email: `paid.${id}@example.test`,
      password: "synthetic-password",
      name: "Paid Example",
      stripeCustomerId: `cus_${id}`,
    });

    getActiveSubscriptionForUser.mockResolvedValue({
      subscriptionType: "basic",
      status: "active",
    });

    await portfolioService.createPortfolio(user._id, "agent", { title: "One" });
    await portfolioService.createPortfolio(user._id, "agent", { title: "Two" });
    const count = await Portfolio.countDocuments({ owner: user._id });
    expect(count).toBe(2);
  });
});