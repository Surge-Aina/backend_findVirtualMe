const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Stub out the welcome email so guestUser.service.createNewUser doesn't try
// to send mail during tests.
jest.mock("../../auth/guestLogin/subUserEmails", () => ({
  sendSubUserWelcomeEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendOwnerActivityRequestEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendSubUserActivityDecisionEmail: jest.fn().mockResolvedValue({ skipped: true }),
}));

const service = require("../portfolioActivity.service");
const Portfolio = require("../../portfolios/models/Portfolio");
const GuestUser = require("../../auth/guestLogin/guestUser.model");
const User = require("../../../shared/models/User");
const PortfolioActivity = require("../models/PortfolioActivity");

let mongoServer;

async function createOwner() {
  const id = new mongoose.Types.ObjectId().toString();
  return User.create({
    userKey: `owner_${id}`,
    practiceId: `owner_${id}`,
    username: `owner_${id}`,
    email: `owner_${id}@test.com`,
    password: "x",
  });
}

async function createPortfolio(ownerId, template = "healthcare") {
  return Portfolio.create({
    owner: ownerId,
    template,
    title: "Test Clinic",
    sections: [],
  });
}

async function createSubUser(portfolioId, overrides = {}) {
  return GuestUser.create({
    name: overrides.name || "Sub",
    email: overrides.email || `sub_${Date.now()}_${Math.random()}@test.com`,
    password: "hashed",
    portfolioType: "healthcare",
    portfolioId: portfolioId.toString(),
    ...overrides,
  });
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("portfolioActivity.service", () => {
  it("sub-user can create a pending activity for their own portfolio", async () => {
    const owner = await createOwner();
    const portfolio = await createPortfolio(owner._id);
    const subUser = await createSubUser(portfolio._id);

    const doc = await service.createByPortfolioUser(subUser, {
      type: "visit",
      serviceLabel: "Annual checkup",
      scheduledFor: new Date(Date.now() + 86400000),
      notes: "First visit",
    });

    expect(doc.status).toBe("pending");
    expect(doc.createdBy).toBe("portfolioUser");
    expect(doc.ownerNotes).toBeUndefined();
    expect(String(doc.portfolioId)).toBe(portfolio._id.toString());
  });

  it("listForPortfolioUser only returns own records on own portfolio", async () => {
    const owner = await createOwner();
    const portfolioA = await createPortfolio(owner._id);
    const portfolioB = await createPortfolio(owner._id);

    const subA = await createSubUser(portfolioA._id);
    const subB = await createSubUser(portfolioB._id);

    await service.createByPortfolioUser(subA, { type: "visit" });
    await service.createByPortfolioUser(subA, { type: "visit" });
    await service.createByPortfolioUser(subB, { type: "visit" });

    const listA = await service.listForPortfolioUser(subA);
    const listB = await service.listForPortfolioUser(subB);

    expect(listA).toHaveLength(2);
    expect(listB).toHaveLength(1);
    for (const a of listA) {
      expect(a.portfolioUserId.toString()).toBe(subA._id.toString());
      expect(a.portfolioId.toString()).toBe(portfolioA._id.toString());
      expect(a.ownerNotes).toBeUndefined();
    }
  });

  it("sub-user on portfolio X cannot read or mutate sub-user Y's records", async () => {
    const owner = await createOwner();
    const portfolio = await createPortfolio(owner._id);
    const subA = await createSubUser(portfolio._id);
    const subB = await createSubUser(portfolio._id);

    const aDoc = await service.createByPortfolioUser(subA, { type: "visit" });

    await expect(
      service.cancelByPortfolioUser(subB, aDoc._id)
    ).rejects.toMatchObject({ status: 403 });

    const listB = await service.listForPortfolioUser(subB);
    expect(listB).toHaveLength(0);
  });

  it("sub-user can only cancel their own pending activities", async () => {
    const owner = await createOwner();
    const portfolio = await createPortfolio(owner._id);
    const sub = await createSubUser(portfolio._id);

    const doc = await service.createByPortfolioUser(sub, { type: "visit" });
    const cancelled = await service.cancelByPortfolioUser(sub, doc._id);
    expect(cancelled.status).toBe("cancelled");

    await expect(
      service.cancelByPortfolioUser(sub, doc._id)
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("owner listing requires ownership of the portfolio", async () => {
    const owner1 = await createOwner();
    const owner2 = await createOwner();
    const portfolio = await createPortfolio(owner1._id);
    const sub = await createSubUser(portfolio._id);
    await service.createByPortfolioUser(sub, { type: "visit" });

    const okList = await service.listForOwner(owner1._id, {
      portfolioId: portfolio._id.toString(),
    });
    expect(okList).toHaveLength(1);

    await expect(
      service.listForOwner(owner2._id, { portfolioId: portfolio._id.toString() })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("owner can approve and complete an activity; status transitions flow", async () => {
    const owner = await createOwner();
    const portfolio = await createPortfolio(owner._id);
    const sub = await createSubUser(portfolio._id);
    const requested = await service.createByPortfolioUser(sub, { type: "visit" });

    const approved = await service.updateByOwner(owner._id, requested._id, {
      status: "confirmed",
      scheduledFor: new Date(),
    });
    expect(approved.status).toBe("confirmed");

    const completed = await service.updateByOwner(owner._id, requested._id, {
      status: "completed",
    });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();
  });

  it("owner can create manual activities; default status is confirmed", async () => {
    const owner = await createOwner();
    const portfolio = await createPortfolio(owner._id);
    const sub = await createSubUser(portfolio._id);

    const doc = await service.createByOwner(owner._id, {
      portfolioId: portfolio._id.toString(),
      portfolioUserId: sub._id.toString(),
      type: "visit",
      serviceLabel: "Walk-in",
    });

    expect(doc.status).toBe("confirmed");
    expect(doc.createdBy).toBe("owner");
  });

  it("rejects owner creating for a sub-user bound to a different portfolio", async () => {
    const owner = await createOwner();
    const portfolioA = await createPortfolio(owner._id);
    const portfolioB = await createPortfolio(owner._id);
    const subB = await createSubUser(portfolioB._id);

    await expect(
      service.createByOwner(owner._id, {
        portfolioId: portfolioA._id.toString(),
        portfolioUserId: subB._id.toString(),
      })
    ).rejects.toMatchObject({ code: "SUB_USER_PORTFOLIO_MISMATCH" });
  });

  it("rejects invalid status values", async () => {
    const owner = await createOwner();
    const portfolio = await createPortfolio(owner._id);
    const sub = await createSubUser(portfolio._id);
    const doc = await service.createByPortfolioUser(sub, { type: "visit" });

    await expect(
      service.updateByOwner(owner._id, doc._id, { status: "bogus" })
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });
});
