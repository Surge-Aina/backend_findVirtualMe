const express = require("express");
const request = require("supertest");
const Portfolio = require("../../portfolios/models/Portfolio");
const ContactMeForm = require("../contactMeForm.model");
const User = require("../../../shared/models/User");
const ProjectManagerPortfolio = require("../../../legacy/project-manager/models/portfolioModel");
const contactRoutes = require("../contactMeForm.routes");

const mockSendGenericContactEmails = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../shared/services/emailService", () => ({
  sendGenericContactEmails: (...args) => mockSendGenericContactEmails(...args),
}));

const app = express();
app.use(express.json());
app.use("/api/contact", contactRoutes);

const TEST_OWNER_ID = "507f1f77bcf86cd799439011";

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

describe("POST /api/contact owner resolution", () => {
  beforeEach(async () => {
    mockSendGenericContactEmails.mockClear();
    await User.findOneAndUpdate(
      { _id: TEST_OWNER_ID },
      {
        username: `contact_owner_${nonce()}`,
        email: `real.owner.${nonce()}@example.test`,
        name: "Real Owner",
        password: "synthetic-password",
        userKey: `uk_${nonce()}`,
        practiceId: `pid_${nonce()}`,
        role: "customer",
      },
      { upsert: true, new: true }
    );
  });

  it("ignores spoofed ownerEmail and emails the portfolio owner", async () => {
    const owner = await User.findById(TEST_OWNER_ID).lean();
    const site = await Portfolio.create({
      owner: TEST_OWNER_ID,
      template: "healthcare",
      title: "Clinic",
      visibility: "public",
      slug: `contact-${nonce()}`,
      sections: [],
    });

    const res = await request(app).post("/api/contact").send({
      name: "Pat Visitor",
      email: "pat.visitor@example.test",
      message: "Hello",
      portfolioId: site._id.toString(),
      ownerEmail: "attacker@example.test",
      ownerName: "Attacker",
    });

    expect(res.status).toBe(201);
    const stored = await ContactMeForm.findOne({ portfolioId: site._id }).lean();
    expect(stored.ownerEmail).toBe(owner.email);
    expect(mockSendGenericContactEmails).toHaveBeenCalledWith(
      expect.objectContaining({ email: "pat.visitor@example.test" }),
      owner.email,
      owner.name
    );
  });

  it("resolves legacy project-manager portfolio by portfolioId only", async () => {
    const pm = await ProjectManagerPortfolio.create({
      userId: TEST_OWNER_ID,
      email: "pm.display@example.test",
      name: "PM Display",
      title: "Manager",
      isPublic: true,
      portfolioName: "PM Site",
    });

    const res = await request(app).post("/api/contact").send({
      name: "Legacy Visitor",
      email: "legacy.visitor@example.test",
      message: "PM contact",
      portfolioId: pm._id.toString(),
    });

    expect(res.status).toBe(201);
    const owner = await User.findById(TEST_OWNER_ID).lean();
    const stored = await ContactMeForm.findOne({ portfolioId: pm._id }).lean();
    expect(stored.ownerEmail).toBe(owner.email);
    expect(stored.ownerEmail).not.toBe("pm.display@example.test");
  });

  it("resolves unified portfolio by slug when portfolioId is omitted", async () => {
    const slug = `slug-contact-${nonce()}`;
    const site = await Portfolio.create({
      owner: TEST_OWNER_ID,
      template: "handyman",
      title: "Slug Site",
      visibility: "public",
      slug,
      sections: [],
    });

    const res = await request(app).post("/api/contact").send({
      name: "Slug Visitor",
      email: "slug.visitor@example.test",
      message: "Via slug",
      slug,
    });

    expect(res.status).toBe(201);
    const stored = await ContactMeForm.findOne({ portfolioId: site._id }).lean();
    expect(stored).toBeTruthy();
  });

  it("rejects requests with no portfolio identifier", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Platform Visitor",
      email: "platform.visitor@example.test",
      message: "FindVirtual.me marketing form",
      ownerEmail: "support@example.test",
      ownerName: "Support",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await ContactMeForm.countDocuments({ email: "platform.visitor@example.test" })).toBe(0);
  });
});