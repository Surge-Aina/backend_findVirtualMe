const { isCompedStripeCustomer } = require("../../../shared/utils/compedStripe");
const User = require("../../../shared/models/User");

jest.mock("../../../shared/models/User");

describe("comped Stripe webhook guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("treats comped stripeCustomerId as skipped", async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ comped: true }),
    });

    await expect(isCompedStripeCustomer("cus_comped_1")).resolves.toBe(true);
    expect(User.findOne).toHaveBeenCalledWith({ stripeCustomerId: "cus_comped_1" });
  });

  it("allows billing webhook work for non-comped customers", async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ comped: false }),
    });

    await expect(isCompedStripeCustomer("cus_paid_1")).resolves.toBe(false);
  });
});