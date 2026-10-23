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
const { eventForSubscription, buildLeadCapturedEvent, buildAppInstalledEvent, buildSitePublishedEvent } = require("../webhookEvents");
const { API_VERSION, API_VERSION_HEADER } = require("../webhookContract");
const contactRoutes = require("../../contact/contactMeForm.routes");
const ContactMeForm = require("../../contact/contactMeForm.model");
const portfolioService = require("../../portfolios/portfolio.service");
const { resetPublicApiRateLimits } = require("../rateLimit");
const { setWebhookTransport, resetWebhookTransport } = require("../webhookUrls");

jest.mock("../../../shared/services/emailService", () => ({
  sendGenericContactEmails: jest.fn().mockResolvedValue(true),
}));

const ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

const app = express();
app.use(express.json());
app.use("/api/developer/webhooks", webhookRoutes);
app.use("/api/contact", contactRoutes);
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
  beforeEach(async () => {
    process.env.PARTNER_CREDENTIALS_KEY = ENCRYPTION_KEY;
    process.env.PARTNER_CREDENTIALS_KEY_VERSION = "1";
    await resetPublicApiRateLimits();
    setWebhookTransport(async () => ({ status: 200 }));
  });

  afterEach(() => {
    resetWebhookTransport();
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
    setWebhookTransport(async (_url, init) => {
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

    const submittedEmail = " Visitor@Example.TEST ";
    const leadId = portfolio._id.toString();
    await dispatchLeadCaptured({
      siteId: portfolio._id,
      leadId,
      email: submittedEmail,
      name: "Visitor Example",
      consent: { contact: true },
      createdAt: new Date("2026-10-23T12:00:00.000Z"),
    });
    await dispatchFormSubmitted({
      siteId: portfolio._id,
      leadId,
      form: "contact",
      email: submittedEmail,
      name: "Visitor Example",
      message: "Hello",
      consent: false,
      submittedAt: new Date("2026-10-23T12:00:00.000Z"),
    });

    const lead = calls.find((call) => JSON.parse(call.body).type === "lead.captured");
    const form = calls.find((call) => JSON.parse(call.body).type === "form.submitted");
    expect(lead).toBeTruthy();
    expect(form).toBeTruthy();
    const leadBody = JSON.parse(lead.body);
    const formBody = JSON.parse(form.body);
    expect(lead.headers[API_VERSION_HEADER]).toBe(API_VERSION);
    expect(leadBody.apiVersion).toBe(API_VERSION);
    expect(leadBody.appId).toBeNull();
    expect(leadBody.installationId).toBeNull();
    expect(leadBody.data.leadId).toBe(leadId);
    expect(formBody.data.leadId).toBe(leadId);
    expect(leadBody.data.email).toBe(submittedEmail);
    expect(formBody.data.email).toBe(submittedEmail);
    expect(leadBody.data.consent).toEqual({ contact: true });
    expect(formBody.data.consent).toEqual({ contact: false });
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
    expect(profile.apiVersion).toBe(API_VERSION);
    expect(profile.appId).toBeNull();
    expect(profile.installationId).toBeNull();
    expect(JSON.stringify(profile)).not.toContain(submittedEmail);

    const rotated = await request(app)
      .post(`/api/developer/webhooks/${created.body.data.id}/rotate`)
      .set("Authorization", sessionFor(user));
    expect(rotated.status).toBe(200);
    expect(rotated.body.secret.startsWith("whsec_")).toBe(true);
    expect(rotated.body.secret).not.toBe(secret);

    setWebhookTransport(async () => ({ status: 204 }));
    const tested = await request(app)
      .post(`/api/developer/webhooks/${created.body.data.id}/test`)
      .set("Authorization", sessionFor(user));
    expect(tested.status).toBe(202);
    expect(tested.body.data.status).toBe("delivered");

    const deliveries = await request(app)
      .get(`/api/developer/webhooks/${created.body.data.id}/deliveries`)
      .set("Authorization", sessionFor(user));
    expect(deliveries.status).toBe(200);
    expect(deliveries.body.data.length).toBeGreaterThan(0);
    const deliveryLog = JSON.stringify(deliveries.body);
    expect(deliveryLog).not.toContain(submittedEmail);
    expect(deliveryLog).not.toContain("visitor@example.test");
    expect(deliveryLog).not.toContain("webhook-test@example.test");
    expect(deliveryLog).not.toContain(rotated.body.secret);
  });

  it("stamps the delivering installation and keeps a paired lead id", () => {
    const event = buildLeadCapturedEvent({
      siteId: "000000000000000000000000",
      leadId: "111111111111111111111111",
      email: "Visitor@Example.TEST",
      consent: null,
      createdAt: new Date("2026-10-23T12:00:00.000Z"),
    });
    const account = eventForSubscription(event, {});
    expect(account.appId).toBeNull();
    expect(account.installationId).toBeNull();
    expect(account.data.consent).toBeNull();
    expect(account.data.email).toBe("Visitor@Example.TEST");
    const stamped = eventForSubscription(event, {
      appId: "222222222222222222222222",
      installationId: "333333333333333333333333",
    });
    expect(stamped.id).toBe(event.id);
    expect(stamped.appId).toBe("222222222222222222222222");
    expect(stamped.installationId).toBe("333333333333333333333333");
    expect(stamped.data.leadId).toBe(event.data.leadId);

    const site = eventForSubscription(
      buildSitePublishedEvent({ siteId: "000000000000000000000000", publishedAt: new Date() }),
      { appId: "222222222222222222222222", installationId: "333333333333333333333333" }
    );
    expect(site.apiVersion).toBe(API_VERSION);
    expect(site.appId).toBe("222222222222222222222222");

    const installed = eventForSubscription(
      buildAppInstalledEvent({
        siteId: "000000000000000000000000",
        appId: "222222222222222222222222",
        installationId: "333333333333333333333333",
        scopes: ["leads:read"],
      }),
      { appId: "999999999999999999999999", installationId: "888888888888888888888888" }
    );
    expect(installed.apiVersion).toBe(API_VERSION);
    expect(installed.appId).toBeUndefined();
    expect(installed.data.appId).toBe("222222222222222222222222");
    expect(installed.data.installationId).toBe("333333333333333333333333");
  });

  it("stores an optional consent answer and emits one lead id for both events", async () => {
    const user = await createUser("form");
    const portfolio = await Portfolio.create({
      owner: user._id,
      slug: `form${nonce()}`,
      title: "Form Clinic",
      template: "healthcare",
      visibility: "public",
    });
    const created = await request(app)
      .post("/api/developer/webhooks")
      .set("Authorization", sessionFor(user))
      .send({ url: "https://hooks.example.test/forms", events: ["lead.captured", "form.submitted"] });
    expect(created.status).toBe(201);

    const calls = [];
    setWebhookTransport(async (_url, init) => {
      calls.push(init);
      return { status: 200 };
    });

    const submittedEmail = "Visitor@Example.TEST";
    const posted = await request(app).post("/api/contact").send({
      name: "Visitor Example",
      email: submittedEmail,
      message: "Hello",
      portfolioId: portfolio._id.toString(),
      ownerEmail: "owner@example.test",
      ownerName: "Owner Example",
      consentContact: false,
    });
    expect(posted.status).toBe(201);
    await flushLifecycleEvents();

    const saved = await ContactMeForm.findOne({ portfolioId: portfolio._id }).lean();
    expect(saved.consentContact).toBe(false);
    expect(saved.email).toBe(submittedEmail);
    const lead = calls.map((call) => JSON.parse(call.body)).find((body) => body.type === "lead.captured");
    const form = calls.map((call) => JSON.parse(call.body)).find((body) => body.type === "form.submitted");
    expect(lead.data.leadId).toBe(saved._id.toString());
    expect(form.data.leadId).toBe(saved._id.toString());
    expect(lead.data.email).toBe(submittedEmail);
    expect(form.data.email).toBe(submittedEmail);
    expect(lead.data.consent).toEqual({ contact: false });
    expect(form.data.consent).toEqual({ contact: false });
    expect(lead.appId).toBeNull();
    expect(lead.installationId).toBeNull();
  });

  it("rejects private, metadata, and credential webhook URLs", async () => {
    const user = await createUser("ssrf");
    const urls = [
      "https://127.0.0.1/hook",
      "https://[::1]/hook",
      "https://[::ffff:169.254.169.254]/hook",
      "https://169.254.169.254/latest",
      "http://hooks.example.test/hook",
      "https://metadata.google.internal./computeMetadata/v1/",
      "https://user:pass@hooks.example.test/hook",
      "https://10.1.2.3/hook",
    ];
    for (const url of urls) {
      const res = await request(app)
        .post("/api/developer/webhooks")
        .set("Authorization", sessionFor(user))
        .send({ url, events: ["lead.captured"] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("validation_error");
    }
  });
});
