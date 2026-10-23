const request = require("supertest");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

jest.mock("../../../shared/services/emailService", () => {
  const actual = jest.requireActual("../../../shared/services/emailService");
  return {
    ...actual,
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendGenericContactEmails: jest.fn().mockResolvedValue(undefined),
  };
});

const emailService = require("../../../shared/services/emailService");
const app = require("../../../index");
const User = require("../../../shared/models/User");
const DomainRoute = require("../../domains/DomainRouter/DomainRouter.model");
const HandymanTemplate = require("../../../legacy/handyman/models/HandymanTemplate");
const ProjectManagerPortfolio = require("../../../legacy/project-manager/models/portfolioModel");
const { parseArgs } = require("../../../../scripts/migratePortfolios");

const HOST = "synthetic-custom.test";

describe("synthetic prod-safety flows", () => {
  let owner;
  let handymanId;
  let projectManagerId;

  beforeEach(async () => {
    emailService.sendPasswordResetEmail.mockClear();
    const password = await bcrypt.hash("OldPass1!", 4);
    owner = await User.create({
      username: "synthetic-owner",
      email: "owner@example.test",
      name: "Synthetic Owner",
      password,
      authProvider: "local",
      role: "customer",
    });

    const handyman = await HandymanTemplate.create({
      userId: owner._id.toString(),
      portfolioName: "Synthetic Handyman",
      isPublic: false,
      hero: { title: "Synthetic repairs", phoneNumber: "555-0100" },
      services: [{ title: "Faucets", description: "Leaks" }],
    });
    handymanId = handyman._id;

    const projectManager = await ProjectManagerPortfolio.create({
      userId: owner._id,
      email: "pm@example.test",
      name: "Synthetic PM",
      title: "Manager",
      isPublic: true,
      portfolioName: "Synthetic PM Site",
    });
    projectManagerId = projectManager._id;

    await DomainRoute.create({
      domain: HOST,
      userId: owner._id,
      portfolioId: handymanId,
      portfolioType: "Handyman",
      isActive: true,
    });
  });

  test("migration script defaults to dry-run", () => {
    expect(parseArgs([]).dryRun).toBe(true);
    expect(parseArgs(["--dry-run"]).dryRun).toBe(true);
    expect(parseArgs(["--write"]).dryRun).toBe(false);
    expect(parseArgs(["--write", "--dry-run"]).dryRun).toBe(true);
  });

  test("legacy domain lookup and portfolio read", async () => {
    const legacyLookup = await request(app).get(
      `/domainRouter/domainLookup?domain=${HOST}`
    );
    expect(legacyLookup.status).toBe(200);
    expect(legacyLookup.body.portfolioType).toBe("Handyman");
    expect(String(legacyLookup.body.portfolioId)).toBe(String(handymanId));

    const lookup = await request(app).get(
      `/api/domains/router/lookup?domain=www.${HOST}`
    );
    expect(lookup.status).toBe(200);
    expect(String(lookup.body.portfolioId)).toBe(String(handymanId));

    const hidden = await request(app).get(`/api/portfolios/${handymanId}`);
    expect(hidden.status).toBe(404);

    const rendered = await request(app)
      .get(`/api/portfolios/${handymanId}`)
      .set("X-Portfolio-Domain-Host", HOST);
    expect(rendered.status).toBe(200);
    expect(rendered.body.template).toBe("handyman");
    expect(rendered.body.sections.map((section) => section.type)).toEqual(
      expect.arrayContaining(["hero", "services", "contact"])
    );
    expect(rendered.body.sections.find((section) => section.type === "hero").data.title).toBe(
      "Synthetic repairs"
    );

    const pm = await request(app).get(`/api/portfolios/${projectManagerId}`);
    expect(pm.status).toBe(200);
    expect(pm.body.template).toBe("projectManager");
    expect(pm.body.visibility).toBe("public");
    expect(pm.body.sections.find((section) => section.type === "summary").data.name).toBe(
      "Synthetic PM"
    );
  });

  test("auth, password reset, and legacy login aliases", async () => {
    const legacyLogin = await request(app).post("/user/login").send({
      email: "owner@example.test",
      password: "OldPass1!",
    });
    expect(legacyLogin.status).toBe(201);
    expect(legacyLogin.body.token).toEqual(expect.any(String));

    const me = await request(app)
      .get("/user/me")
      .set("Authorization", `Bearer ${legacyLogin.body.token}`);
    expect(me.status).toBe(200);

    const currentLogin = await request(app).post("/api/auth/login").send({
      email: "owner@example.test",
      password: "OldPass1!",
    });
    expect(currentLogin.status).toBe(201);

    const forgot = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "owner@example.test" });
    expect(forgot.status).toBe(200);
    expect(forgot.body.success).toBe(true);

    const resetUrl = emailService.sendPasswordResetEmail.mock.calls[0][2];
    const token = resetUrl.split("/reset-password/")[1];
    expect(token).toEqual(expect.any(String));

    const reset = await request(app)
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: "NewPass1!" });
    expect(reset.status).toBe(200);
    expect(reset.body.success).toBe(true);

    const oldPassword = await request(app).post("/api/auth/login").send({
      email: "owner@example.test",
      password: "OldPass1!",
    });
    expect(oldPassword.status).toBe(400);

    const newPassword = await request(app).post("/api/auth/login").send({
      email: "owner@example.test",
      password: "NewPass1!",
    });
    expect(newPassword.status).toBe(201);
  });

  test("public contact form resolves the owner from the portfolio", async () => {
    const res = await request(app).post("/api/portfolio/contact").send({
      name: "Visitor",
      email: "visitor@example.test",
      message: "Hello from a synthetic site",
      portfolioId: projectManagerId.toString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test("legacy stripe webhook paths are mounted", async () => {
    const subscription = await request(app)
      .post("/stripe-webhook/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=not-a-real-signature")
      .send("{}");
    expect(subscription.status).toBe(400);

    const domain = await request(app)
      .post("/stripe-webhook/domainPayment-webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=not-a-real-signature")
      .send("{}");
    expect(domain.status).toBe(400);
  });

  test("unknown domain does not render a portfolio", async () => {
    const missing = await request(app).get(
      "/api/domains/router/lookup?domain=missing.example.test"
    );
    expect(missing.status).toBe(404);
    expect(mongoose.Types.ObjectId.isValid(handymanId)).toBe(true);
  });
});
