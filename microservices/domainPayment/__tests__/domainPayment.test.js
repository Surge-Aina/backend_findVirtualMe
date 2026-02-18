// Mock all external services before imports
jest.mock("../services/namecheapProxy.service");
jest.mock("../../../services/vercelService");
jest.mock("../../../models/User");
jest.mock("../../DomainRouter/DomainRouter.service");
jest.mock("../../DomainRouter/DomainRouter.model");
jest.mock("stripe",() => {
  return jest.fn(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: "https://stripe.com/pay/test" }),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

const request = require("supertest");
// Mock auth middleware to skip JWT verification
jest.mock("../../../middleware/auth", () => (req, res, next) => {
  req.user = { id: "user123", email: "test@test.com" };
  next();
});
const express = require("express");
// Build a minimal app with ONLY the domainPayment router
const app = express();
app.use(express.json());
app.use("/api/domainPayment", require("../stripe/stripe.route"));


const namecheap = require("../services/namecheapProxy.service");
const vercelService = require("../../../services/vercelService");
const User = require("../../../models/User");

// --- Reusable mock data ---
const mockPricingResponse = {
  CommandResponse: {
    UserGetPricingResult: {
      ProductType: {
        ProductCategory: {
          $: { Name: "REGISTER" },
          Product: {
            $: { Name: "com" },
            Price: [{ $: { Duration: "1", Price: "9.06", AdditionalCost: "0.18" } }],
          },
        },
      },
    },
  },
};

const mockDomainAvailableResponse = {
  CommandResponse: {
    DomainCheckResult: {
      $: { Available: "true", IsPremiumName: "false", IcannFee: "0.18" },
    },
  },
};

const mockDomainUnavailableResponse = {
  CommandResponse: {
    DomainCheckResult: {
      $: { Available: "false" },
    },
  },
};

// -------------------------------------------------------
// PRICE CHECK TESTS
// -------------------------------------------------------
describe("GET /api/domainPayment/pricecheck/:domain", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns price for an available .com domain", async () => {
    namecheap.checkDomain.mockResolvedValue(mockDomainAvailableResponse);
    namecheap.getPricing.mockResolvedValue(mockPricingResponse);

    const res = await request(app).get("/api/domainPayment/pricecheck/example.com");

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.totalPrice).toBeDefined();
    expect(namecheap.checkDomain).toHaveBeenCalledWith("example.com");
  });

  test("returns unavailable for a taken domain", async () => {
    namecheap.checkDomain.mockResolvedValue(mockDomainUnavailableResponse);

    const res = await request(app).get("/api/domainPayment/pricecheck/taken.com");

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test("returns price for a premium domain", async () => {
    namecheap.checkDomain.mockResolvedValue({
      CommandResponse: {
        DomainCheckResult: {
          $: {
            Available: "true",
            IsPremiumName: "true",
            PremiumRegistrationPrice: "500.00",
            IcannFee: "0.18",
          },
        },
      },
    });

    const res = await request(app).get("/api/domainPayment/pricecheck/premium.com");

    expect(res.status).toBe(200);
    expect(res.body.isPremium).toBe(true);
    expect(res.body.totalPrice).toBe("500.18");
  });

  test("returns 500 if namecheap throws", async () => {
    namecheap.checkDomain.mockRejectedValue(new Error("Namecheap down"));

    const res = await request(app).get("/api/domainPayment/pricecheck/error.com");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Namecheap down");
  });
});

// -------------------------------------------------------
// FULFILLMENT TESTS
// -------------------------------------------------------
describe("handleFulfillment", () => {
  const { handleFulfillment } = require("../services/fulfillment.service");
  const { createDomainMapping } = require("../../DomainRouter/DomainRouter.service");

  beforeEach(() => jest.clearAllMocks());

  test("skips if payment already processed", async () => {
    User.findOne.mockResolvedValue({ _id: "existingUser" });

    await handleFulfillment("example.com", "user123", "pi_already_done");

    expect(namecheap.registerDomain).not.toHaveBeenCalled();
  });

  test("full happy path: registers domain, adds to vercel, updates user", async () => {
    User.findOne.mockResolvedValue(null); // not already processed
    namecheap.registerDomain.mockResolvedValue({});
    vercelService.addDomain.mockResolvedValue({ verified: true, verification: [] });
    User.findOneAndUpdate.mockResolvedValue({});
    createDomainMapping.mockResolvedValue({});

    await handleFulfillment("example.com", "user123", "pi_new");

    expect(namecheap.registerDomain).toHaveBeenCalledWith({ domain: "example.com" });
    expect(vercelService.addDomain).toHaveBeenCalledWith("example.com");
    expect(User.findOneAndUpdate).toHaveBeenCalled();
    expect(createDomainMapping).toHaveBeenCalled();
  });

  test("marks domain as manual_intervention_required if vercel fails", async () => {
    User.findOne.mockResolvedValue(null);
    namecheap.registerDomain.mockResolvedValue({});
    vercelService.addDomain.mockRejectedValue(new Error("Vercel error"));
    User.updateOne.mockResolvedValue({});

    await handleFulfillment("example.com", "user123", "pi_vercel_fail");

    expect(User.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $push: expect.objectContaining({
          domains: expect.objectContaining({ status: "manual_intervention_required" }),
        }),
      })
    );
  });

  test("marks domain as failed_registration if namecheap throws", async () => {
    User.findOne.mockResolvedValue(null);
    namecheap.registerDomain.mockRejectedValue(new Error("Namecheap failed"));
    User.updateOne.mockResolvedValue({});

    await handleFulfillment("example.com", "user123", "pi_nc_fail");

    expect(User.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $push: expect.objectContaining({
          domains: expect.objectContaining({ status: "failed_registration" }),
        }),
      })
    );
  });
});