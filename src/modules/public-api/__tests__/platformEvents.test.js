const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const { WebhookEndpoint } = require("../webhookEndpoint.model");
const webhookRoutes = require("../webhooks.routes");
const { mountPublicApi } = require("../mount");
const { encryptSecret, decryptSecret } = require("../secretBox");
const { signWebhookPayload, verifyWebhookSignature } = require("../webhookSignature");
const {
  dispatchLeadCaptured,
  dispatchFormSubmitted,
  flushLifecycleEvents,
} = require("../lifecycleEvents");
const portfolioService = require("../../portfolios/portfolio.service");
const { resetPublicApiRateLimits } = require("../rateLimit");

jest.mock("../../../shared/services/emailService", () => ({
  sendGenericContactEmails: jest.fn().mockResolvedValue(true),
}));

const ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

const app = express();
app.use(express.json());
app.use("/api/developer/webhooks", webhookRoutes);
mountPublicApi(app);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

function sessionFor(user) {
  return `Bearer ${jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "20m" })}`;
}

async function createUser(tag) {
  const id = nonce();
  return User.create({
    username: `acct_${tag}_${id}`,
    email: `mailbox.${tag}.${id}@example.test`,
    password: "synthetic-password",
    userKey: `uk_${id}`,
    practiceId: `pid_${id}`,
    role: "customer",
  });
}

describe("signed event catalog", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.PARTNER_CREDENTIALS_KEY = ENCRYPTION_KEY;
    process.env.PARTNER_CREDENTIALS_KEY_VERSION = "1";
    await resetPublicApiRateLimits();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("encrypts webhook secrets and signs lead.captured", async () => {
    const sealed = encryptSecret("synthetic-secret-value");
    expect(decryptSecret(sealed)).toBe("synthetic-secret-value");

    const user = await createUser("hooks");
    const created = await request(app)
      .post("/api/developer/webhooks")
      .set("Authorization", sessionFor(user))
      .send({
        url: "https://hooks.example.test/inbound",
        events: ["lead.captured", "form.submitted", "business_profile.updated", "site.published"],
      });
    expect(created.status).toBe(201);
    const secret = created.body.secret;
    expect(secret.startsWith("whsec_")).toBe(true);
    const stored = await WebhookEndpoint.findById(created.body.data.id).lean();
    expect(JSON.stringify(stored)).not.toContain(secret);

    const calls = [];
    global.fetch.mockImplementation(async (_url, init) => {
      calls.push(init);
      return { status: 200 };
    });

    const portfolio = await Portfolio.create({
      owner: user._id,
      slug: `clinic${nonce()}`,
      title: "Synthetic Clinic",
      template: "healthcare",
      visibility: "public",
    });

    await dispatchLeadCaptured({
      siteId: portfolio._id,
      email: "visitor@example.test",
      name: "Visitor Example",
      createdAt: new Date("2026-10-23T12:00:00.000Z"),
    });
    await dispatchFormSubmitted({
      siteId: portfolio._id,
      form: "contact",
      email: "visitor@example.test",
      name: "Visitor Example",
      message: "Hello",
      submittedAt: new Date("2026-10-23T12:00:00.000Z"),
    });

    const lead = calls.find((call) => JSON.parse(call.body).type === "lead.captured");
    const form = calls.find((call) => JSON.parse(call.body).type === "form.submitted");
    expect(lead).toBeTruthy();
    expect(form).toBeTruthy();
    const timestamp = lead.headers["X-FindVirtualMe-Timestamp"];
    expect(lead.headers["X-FindVirtualMe-Signature"]).toBe(
      `v1=${signWebhookPayload(secret, timestamp, lead.body)}`
    );
    expect(
      verifyWebhookSignature({
        secret,
        timestamp,
        rawBody: lead.body,
        signatureHeaderValue: lead.headers["X-FindVirtualMe-Signature"],
        nowSeconds: Number(timestamp),
      })
    ).toBe(true);
    expect(JSON.parse(form.body).data.form).toBe("contact");
    expect(JSON.stringify(calls)).not.toContain(secret);

    const callsBefore = calls.length;
    await portfolioService.updatePortfolio(portfolio._id, { title: "Renamed Clinic" });
    await flushLifecycleEvents();
    const profileCall = calls.slice(callsBefore).find((call) =>
      String(call.body).includes("business_profile.updated")
    );
    expect(profileCall).toBeTruthy();
    const profile = JSON.parse(profileCall.body);
    expect(profile.data.businessName).toBe("Renamed Clinic");
    expect(profile.data.siteId).toBe(portfolio._id.toString());
    expect(JSON.stringify(profile)).not.toContain("visitor@example.test");
  });
});
