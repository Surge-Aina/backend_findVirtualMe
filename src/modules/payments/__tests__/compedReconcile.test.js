jest.mock("stripe");
const { mockSubscriptionsList } = require("stripe");

jest.mock("../../../shared/models/Subscriptions");
jest.mock("../../../shared/models/User", () => ({
  find: jest.fn(),
}));

const Subscriptions = require("../../../shared/models/Subscriptions");
const User = require("../../../shared/models/User");
const { reconcileSubscriptions } = require("../subscriptions.controller");

describe("reconcileSubscriptions comped exclusion", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
    Subscriptions.find.mockResolvedValue([]);
    User.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { stripeCustomerId: "cus_comped", email: "comped@example.com" },
      ]),
    });
    Subscriptions.create.mockImplementation(async (doc) => doc);
    mockSubscriptionsList.mockResolvedValue({
      has_more: false,
      data: [
        {
          id: "sub_comped",
          customer: { id: "cus_comped", email: "comped@example.com", name: "X" },
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
                id: "si_1",
                quantity: 1,
              },
            ],
          },
          latest_invoice: null,
          default_payment_method: null,
          discounts: null,
        },
        {
          id: "sub_paid",
          customer: { id: "cus_paid", email: "paid@example.com", name: "Y" },
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
                id: "si_2",
                quantity: 1,
              },
            ],
          },
          latest_invoice: null,
          default_payment_method: null,
          discounts: null,
        },
      ],
    });
  });

  it("skips comped users during reconcile", async () => {
    await reconcileSubscriptions(req, res);

    expect(Subscriptions.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total_reconciled: 1,
        skipped_comped: 1,
      })
    );
  });
});