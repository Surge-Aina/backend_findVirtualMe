const express = require("express");
const request = require("supertest");
const Portfolio = require("../models/Portfolio");
const PortfolioDraft = require("../models/PortfolioDraft");
const ComponentAudit = require("../models/ComponentAudit");
const ContactMeForm = require("../../contact/contactMeForm.model");
const User = require("../../../shared/models/User");
const { createKey } = require("../../public-api/apiKey.service");
const { mountPublicApi } = require("../../public-api/mount");
const { mountMcp } = require("../../public-api/mcp");
const bookingRequestRoutes = require("../../booking-request/bookingRequest.routes");

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";

jest.mock("../../../shared/middleware/auth", () => (req, _res, next) => {
  req.user = { _id: TEST_USER_ID, id: TEST_USER_ID, email: "owner@example.test" };
  next();
});

jest.mock("../../../shared/services/s3Service", () => ({
  deleteManyByPrefix: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  }))
);

const mockSendGenericContactEmails = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../shared/services/emailService", () => ({
  sendGenericContactEmails: (...args) => mockSendGenericContactEmails(...args),
}));

const portfolioRoutes = require("../portfolio.routes");

const ownerApp = express();
ownerApp.use(express.json());
ownerApp.use("/api/portfolios", portfolioRoutes);

const publicApp = express();
publicApp.use(express.json());
mountPublicApi(publicApp);
publicApp.use("/api/booking-requests", bookingRequestRoutes);

const mcpApp = express();
mcpApp.use(express.json());
mountMcp(mcpApp);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

function futureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function createOwnerPortfolio(overrides = {}) {
  return Portfolio.create({
    owner: TEST_USER_ID,
    template: "healthcare",
    title: "Booking Clinic",
    visibility: "public",
    slug: `book-${nonce()}`,
    sections: [{ type: "hero", order: 0, data: { headline: "Welcome" } }],
    ...overrides,
  });
}

async function issueWriteKey() {
  return createKey({
    userId: TEST_USER_ID,
    scopes: ["sites:read", "sites:write"],
    name: `Write-${nonce()}`,
  });
}

async function addPublishedBookingSection(site, props = {}) {
  const writeKey = await issueWriteKey();
  const added = await request(publicApp)
    .post(`/api/public/v1/sites/${site._id}/components`)
    .set("Authorization", `Bearer ${writeKey.secret}`)
    .send({
      type: "BookingRequest",
      props: {
        sectionTitle: "Book",
        timezone: "America/New_York",
        minNoticeHours: 0,
        daysAheadMax: 30,
        ...props,
      },
    });
  expect(added.status).toBe(201);
  await request(ownerApp).post(`/api/portfolios/${site._id}/publish`);
  return added.body.data.section.sectionId;
}

describe("BookingRequest feature component", () => {
  const originalComponents = process.env.FEATURE_COMPONENTS_ENABLED;
  const originalDrafts = process.env.SITE_DRAFTS_ENABLED;
  const originalBooking = process.env.FEATURE_COMPONENT_BOOKING_ENABLED;

  afterAll(async () => {
    if (originalComponents === undefined) delete process.env.FEATURE_COMPONENTS_ENABLED;
    else process.env.FEATURE_COMPONENTS_ENABLED = originalComponents;
    if (originalDrafts === undefined) delete process.env.SITE_DRAFTS_ENABLED;
    else process.env.SITE_DRAFTS_ENABLED = originalDrafts;
    if (originalBooking === undefined) delete process.env.FEATURE_COMPONENT_BOOKING_ENABLED;
    else process.env.FEATURE_COMPONENT_BOOKING_ENABLED = originalBooking;
    await bookingRequestRoutes.bookingRequestIpLimit.reset();
  });

  beforeEach(async () => {
    mockSendGenericContactEmails.mockClear();
    await bookingRequestRoutes.bookingRequestIpLimit.reset();
    await User.findOneAndUpdate(
      { _id: TEST_USER_ID },
      {
        username: `book_owner_${nonce()}`,
        email: `book.owner.${nonce()}@example.test`,
        password: "synthetic-password",
        userKey: `uk_${nonce()}`,
        practiceId: `pid_${nonce()}`,
        role: "customer",
      },
      { upsert: true, new: true }
    );
  });

  describe("FEATURE_COMPONENT_BOOKING_ENABLED=false", () => {
    beforeEach(() => {
      process.env.FEATURE_COMPONENTS_ENABLED = "true";
      process.env.SITE_DRAFTS_ENABLED = "true";
      process.env.FEATURE_COMPONENT_BOOKING_ENABLED = "false";
    });

    it("omits BookingRequest from owner registry and rejects writes", async () => {
      const site = await createOwnerPortfolio();
      const listed = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(listed.status).toBe(200);
      expect(listed.body.config.components.BookingRequest).toBeUndefined();

      const writeKey = await issueWriteKey();
      const added = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "BookingRequest",
          props: { sectionTitle: "Book", timezone: "America/New_York" },
        });
      expect(added.status).toBe(404);
      expect(added.body.error.code).toBe("FEATURE_COMPONENT_BOOKING_DISABLED");
    });

    it("hides BookingRequest from MCP list_components", async () => {
      const site = await createOwnerPortfolio();
      const readKey = await createKey({
        userId: TEST_USER_ID,
        scopes: ["sites:read"],
        name: "Read",
      });
      const mcp = await request(mcpApp)
        .post("/api/mcp")
        .set("Authorization", `Bearer ${readKey.secret}`)
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "list_components", arguments: { siteId: String(site._id) } },
        });
      expect(mcp.status).toBe(200);
      expect(JSON.stringify(mcp.body)).not.toContain("BookingRequest");
    });

    it("rejects public booking submit", async () => {
      const site = await createOwnerPortfolio();
      const res = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id,
        requestedStart: futureIso(48),
        requestedEnd: futureIso(50),
      });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_COMPONENT_BOOKING_DISABLED");
    });
  });

  describe("with booking flag on", () => {
    beforeEach(() => {
      process.env.FEATURE_COMPONENTS_ENABLED = "true";
      process.env.SITE_DRAFTS_ENABLED = "true";
      process.env.FEATURE_COMPONENT_BOOKING_ENABLED = "true";
    });

    it("registers BookingRequest with submission endpoint metadata", async () => {
      const site = await createOwnerPortfolio();
      const res = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(res.body.config.components.BookingRequest.metadata).toMatchObject({
        blockType: "bookingRequest",
        submissionEndpoint: "/api/booking-requests",
      });
    });

    it("keeps BookingRequest draft-only until publish", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();
      const readKey = await createKey({
        userId: TEST_USER_ID,
        scopes: ["sites:read"],
        name: "Read",
      });

      await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "BookingRequest",
          props: {
            sectionTitle: "Book us",
            timezone: "America/New_York",
            minNoticeHours: 2,
            daysAheadMax: 14,
            services: [{ name: "Consult" }],
          },
        });

      const publicListed = await request(publicApp)
        .get(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${readKey.secret}`);
      expect(publicListed.body.data.data.content.some((c) => c.type === "BookingRequest")).toBe(
        false
      );

      await request(ownerApp).post(`/api/portfolios/${site._id}/publish`);

      const after = await request(publicApp)
        .get(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${readKey.secret}`);
      expect(after.body.data.data.content.some((c) => c.type === "BookingRequest")).toBe(true);
    });

    it("denies cross-tenant component writes", async () => {
      const otherSite = await Portfolio.create({
        owner: OTHER_USER_ID,
        template: "healthcare",
        title: "Other",
        visibility: "public",
        slug: `other-${nonce()}`,
        sections: [],
      });
      const writeKey = await issueWriteKey();
      const res = await request(publicApp)
        .post(`/api/public/v1/sites/${otherSite._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "BookingRequest",
          props: { sectionTitle: "X", timezone: "America/Chicago" },
        });
      expect(res.status).toBe(404);
    });

    it("validates booking window and stores a booking lead", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();

      const added = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "BookingRequest",
          props: {
            sectionTitle: "Book",
            timezone: "America/New_York",
            minNoticeHours: 24,
            daysAheadMax: 7,
            services: [{ name: "Checkup" }],
          },
        });
      expect(added.status).toBe(201);
      const sectionId = added.body.data.section.sectionId;
      await request(ownerApp).post(`/api/portfolios/${site._id}/publish`);

      const tooSoon = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        phone: "555-0100",
        portfolioId: site._id.toString(),
        sectionId,
        service: "Checkup",
        requestedStart: futureIso(2),
        requestedEnd: futureIso(3),
      });
      expect(tooSoon.status).toBe(400);
      expect(tooSoon.body.code).toBe("booking_window_too_soon");

      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const ok = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        phone: "555-0100",
        portfolioId: site._id.toString(),
        sectionId,
        service: "Checkup",
        requestedStart: futureIso(48),
        requestedEnd: futureIso(50),
      });
      expect(ok.status).toBe(201);
      expect(ok.body.leadId).toBeUndefined();

      const stored = await ContactMeForm.findOne({ portfolioId: site._id, leadType: "booking" }).lean();
      expect(stored).toBeTruthy();
      expect(stored.bookingService).toBe("Checkup");
      expect(stored.email).toBe("pat.visitor@example.test");

      const allLogCalls = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(" ");
      expect(allLogCalls).not.toContain("pat.visitor@example.test");

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("rate limits repeated booking submissions by IP", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();
      const added = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "BookingRequest",
          props: {
            sectionTitle: "Book",
            timezone: "UTC",
            minNoticeHours: 0,
            daysAheadMax: 30,
          },
        });
      const sectionId = added.body.data.section.sectionId;
      await request(ownerApp).post(`/api/portfolios/${site._id}/publish`);

      const body = {
        name: "Rate Visitor",
        email: "rate.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId,
        requestedStart: futureIso(48),
        requestedEnd: futureIso(49),
      };

      for (let i = 0; i < 20; i += 1) {
        const res = await request(publicApp)
          .post("/api/booking-requests")
          .set("X-Forwarded-For", "198.51.100.77")
          .send({ ...body, email: `rate.${i}@example.test` });
        expect(res.status).toBe(201);
      }

      const limited = await request(publicApp)
        .post("/api/booking-requests")
        .set("X-Forwarded-For", "198.51.100.77")
        .send(body);
      expect(limited.status).toBe(429);
    });

    it("records component audit on add", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();
      await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "BookingRequest",
          props: { sectionTitle: "Audit", timezone: "America/Los_Angeles" },
        });

      const audits = await ComponentAudit.find({ portfolioId: site._id }).lean();
      expect(audits.some((a) => a.componentId === "BookingRequest" && a.action === "add")).toBe(
        true
      );
    });

    it("ignores attacker ownerEmail and notifies the portfolio owner", async () => {
      const ownerEmail = `real.owner.${nonce()}@example.test`;
      await User.findByIdAndUpdate(TEST_USER_ID, { email: ownerEmail, name: "Real Owner" });
      const site = await createOwnerPortfolio();
      const sectionId = await addPublishedBookingSection(site, {
        services: [{ name: "Consult" }],
      });

      const res = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId,
        service: "Consult",
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
        ownerEmail: "attacker@example.test",
        ownerName: "Attacker",
      });
      expect(res.status).toBe(201);
      const stored = await ContactMeForm.findOne({ portfolioId: site._id, leadType: "booking" }).lean();
      expect(stored.ownerEmail).toBe(ownerEmail);
      expect(mockSendGenericContactEmails).toHaveBeenCalledWith(
        expect.objectContaining({ email: "pat.visitor@example.test" }),
        ownerEmail,
        "Real Owner"
      );
    });

    it("accepts honeypot spam silently without storing a lead", async () => {
      const site = await createOwnerPortfolio();
      const sectionId = await addPublishedBookingSection(site);
      const res = await request(publicApp).post("/api/booking-requests").send({
        name: "Bot",
        email: "bot@example.test",
        portfolioId: site._id.toString(),
        sectionId,
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
        _hp: "filled",
      });
      expect(res.status).toBe(201);
      const count = await ContactMeForm.countDocuments({ portfolioId: site._id });
      expect(count).toBe(0);
    });

    it("rejects private sites and unpublished sites", async () => {
      const site = await createOwnerPortfolio({ visibility: "private" });
      const sectionId = await addPublishedBookingSection(site);
      const closed = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId,
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
      });
      expect(closed.status).toBe(404);
      expect(closed.body.code).toBe("not_found");

      const draftOnly = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();
      const added = await request(publicApp)
        .post(`/api/public/v1/sites/${draftOnly._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "BookingRequest",
          props: { sectionTitle: "Draft", timezone: "America/New_York" },
        });
      const draftSectionId = added.body.data.section.sectionId;
      const unpublished = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: draftOnly._id.toString(),
        sectionId: draftSectionId,
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
      });
      expect(unpublished.status).toBe(404);
    });

    it("returns 404 for invalid, unknown, or hidden sectionId", async () => {
      const site = await createOwnerPortfolio({
        publishedVersionNumber: 1,
        sections: [
          { type: "hero", order: 0, data: { headline: "Hi" } },
          {
            type: "bookingRequest",
            order: 1,
            visible: true,
            data: {
              sectionTitle: "Visible",
              timezone: "America/New_York",
              minNoticeHours: 0,
              daysAheadMax: 30,
            },
          },
          {
            type: "bookingRequest",
            order: 2,
            visible: false,
            data: {
              sectionTitle: "Hidden",
              timezone: "America/New_York",
              minNoticeHours: 0,
              daysAheadMax: 30,
            },
          },
        ],
      });
      const live = await Portfolio.findById(site._id).lean();
      const visibleId = String(
        live.sections.find((s) => s.type === "bookingRequest" && s.visible !== false)._id
      );
      const hiddenId = String(
        live.sections.find((s) => s.type === "bookingRequest" && s.visible === false)._id
      );

      const invalid = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId: "not-valid",
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
      });
      expect(invalid.status).toBe(404);

      const unknown = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId: "507f1f77bcf86cd799439099",
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
      });
      expect(unknown.status).toBe(404);

      const hiddenRes = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId: hiddenId,
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
      });
      expect(hiddenRes.status).toBe(404);

      const visibleRes = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId: visibleId,
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
      });
      expect(visibleRes.status).toBe(201);
    });

    it("rejects date-only datetimes and invalid services without listing allowed values", async () => {
      const site = await createOwnerPortfolio();
      const sectionId = await addPublishedBookingSection(site, {
        services: [{ name: "Consult" }],
      });

      const dateOnly = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId,
        service: "Consult",
        requestedStart: "2030-06-01",
        requestedEnd: "2030-06-01T15:00:00",
      });
      expect(dateOnly.status).toBe(400);

      const badService = await request(publicApp).post("/api/booking-requests").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        portfolioId: site._id.toString(),
        sectionId,
        service: "Not Listed",
        requestedStart: futureIso(72),
        requestedEnd: futureIso(73),
      });
      expect(badService.status).toBe(400);
      expect(badService.body.details?.allowed).toBeUndefined();
    });

    it("maps section.data to legacy bookingRequest shape", async () => {
      const site = await createOwnerPortfolio({
        sections: [
          {
            type: "bookingRequest",
            order: 1,
            visible: true,
            data: {
              sectionTitle: "Request",
              intro: "Tell us when.",
              services: ["Consult"],
              minNoticeHours: 12,
              daysAheadMax: 20,
              timezone: "America/Chicago",
              confirmationText: "Sent.",
            },
          },
        ],
      });
      const res = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      const item = res.body.data.content.find((c) => c.type === "BookingRequest");
      expect(item.props.sectionTitle).toBe("Request");
      expect(item.props.services).toEqual([{ name: "Consult" }]);
    });
  });
});