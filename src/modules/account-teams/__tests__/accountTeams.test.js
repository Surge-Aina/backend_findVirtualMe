const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Portfolio = require("../../portfolios/models/Portfolio");
const Account = require("../models/Account");
const AccountMembership = require("../models/AccountMembership");
const User = require("../../../shared/models/User");
const accountAccess = require("../accountAccess.service");

const OWNER_ID = "507f1f77bcf86cd799439011";
const EDITOR_ID = "507f1f77bcf86cd799439012";
const VIEWER_ID = "507f1f77bcf86cd799439013";
const STRANGER_ID = "507f1f77bcf86cd799439014";

let mockCurrentUser = {
  _id: OWNER_ID,
  id: OWNER_ID,
  role: "customer",
  email: "owner@example.test",
};

jest.mock("../../../shared/middleware/auth", () => (req, _res, next) => {
  req.user = { ...mockCurrentUser };
  next();
});

jest.mock("../../../shared/middleware/optionalAuth", () => (req, _res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token === "test-session") {
    req.user = { ...mockCurrentUser };
  }
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

const portfolioRoutes = require("../../portfolios/portfolio.routes");
const accountRoutes = require("../accounts.routes");
const authHttpRoutes = require("../../auth/auth.http.routes");

const app = express();
app.use(express.json());
app.use("/api/portfolios", portfolioRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/auth", authHttpRoutes);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

async function upsertUser(id, email, role = "customer") {
  return User.findOneAndUpdate(
    { _id: id },
    {
      username: `user_${nonce()}`,
      email,
      password: "synthetic-password",
      userKey: `uk_${nonce()}`,
      practiceId: `pid_${nonce()}`,
      role,
    },
    { upsert: true, new: true }
  );
}

describe("Account teams", () => {
  const originalFlag = process.env.ACCOUNT_TEAMS_ENABLED;
  const originalSuperEmail = process.env.SUPER_ADMIN_EMAIL;
  const originalSuperHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

  beforeEach(async () => {
    process.env.ACCOUNT_TEAMS_ENABLED = "true";
    process.env.SUPER_ADMIN_EMAIL = "super@example.test";
    process.env.SUPER_ADMIN_PASSWORD_HASH = await bcrypt.hash("super-secret", 4);
    mockCurrentUser = {
      _id: OWNER_ID,
      id: OWNER_ID,
      role: "customer",
      email: "owner@example.test",
    };
    await upsertUser(OWNER_ID, "owner@example.test");
    await upsertUser(EDITOR_ID, "editor@example.test");
    await upsertUser(VIEWER_ID, "viewer@example.test");
    await upsertUser(STRANGER_ID, "stranger@example.test");
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.ACCOUNT_TEAMS_ENABLED;
    else process.env.ACCOUNT_TEAMS_ENABLED = originalFlag;
    if (originalSuperEmail === undefined) delete process.env.SUPER_ADMIN_EMAIL;
    else process.env.SUPER_ADMIN_EMAIL = originalSuperEmail;
    if (originalSuperHash === undefined) delete process.env.SUPER_ADMIN_PASSWORD_HASH;
    else process.env.SUPER_ADMIN_PASSWORD_HASH = originalSuperHash;
  });

  async function seedWorkspace() {
    const account = await Account.create({
      name: "Team workspace",
      createdBy: OWNER_ID,
      createdFromOwner: OWNER_ID,
    });
    await AccountMembership.create({
      account: account._id,
      user: OWNER_ID,
      email: "owner@example.test",
      role: "account_admin",
      status: "active",
    });
    await AccountMembership.create({
      account: account._id,
      user: EDITOR_ID,
      email: "editor@example.test",
      role: "editor",
      status: "active",
    });
    await AccountMembership.create({
      account: account._id,
      user: VIEWER_ID,
      email: "viewer@example.test",
      role: "viewer",
      status: "active",
    });
    const portfolio = await Portfolio.create({
      owner: OWNER_ID,
      account: account._id,
      template: "agent",
      title: "Team site",
      visibility: "private",
      slug: `team-${nonce()}`,
      sections: [{ type: "summary", order: 0, data: { name: "Private" } }],
    });
    return { account, portfolio };
  }

  it("returns 404 for account routes when flag is off", async () => {
    process.env.ACCOUNT_TEAMS_ENABLED = "false";
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ACCOUNT_TEAMS_DISABLED");
  });

  it("lists accounts for the authenticated user", async () => {
    await seedWorkspace();
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body.accounts.length).toBeGreaterThanOrEqual(1);
    expect(res.body.accounts[0]).toMatchObject({ role: "account_admin" });
  });

  it("does not include super admin in member list", async () => {
    const { account } = await seedWorkspace();
    await AccountMembership.create({
      account: account._id,
      email: process.env.SUPER_ADMIN_EMAIL,
      role: "account_admin",
      status: "invited",
    });
    const res = await request(app).get(`/api/accounts/${account._id}/members`);
    expect(res.status).toBe(200);
    const emails = res.body.members.map((m) => m.email);
    expect(emails).not.toContain(process.env.SUPER_ADMIN_EMAIL);
  });

  it("enforces editor vs viewer portfolio permissions at the service layer", async () => {
    const { account, portfolio } = await seedWorkspace();
    const plain = await Portfolio.findById(portfolio._id).lean();

    const editorCheck = await accountAccess.assertPortfolioMutationAccess(
      portfolio._id,
      { _id: EDITOR_ID, role: "customer" }
    );
    expect(editorCheck.ok).toBe(true);

    const viewerCheck = await accountAccess.assertPortfolioMutationAccess(
      portfolio._id,
      { _id: VIEWER_ID, role: "customer" }
    );
    expect(viewerCheck.ok).toBe(false);
    expect(viewerCheck.status).toBe(403);

    expect(
      await accountAccess.canUserViewPortfolio(plain, { _id: VIEWER_ID, role: "customer" })
    ).toBe(true);
    expect(
      await accountAccess.canUserViewPortfolio(plain, { _id: STRANGER_ID, role: "customer" })
    ).toBe(false);

    mockCurrentUser = {
      _id: EDITOR_ID,
      id: EDITOR_ID,
      role: "customer",
      email: "editor@example.test",
    };
    const mine = await request(app)
      .get("/api/portfolios/mine")
      .set("X-Account-Id", String(account._id));
    expect(mine.status).toBe(200);
    expect(mine.body.portfolios.some((p) => String(p._id) === String(portfolio._id))).toBe(true);
  });

  it("allows super admin portfolio mutation access for component writes", async () => {
    const { portfolio } = await seedWorkspace();
    const { buildSuperAdminUser } = require("../superAdmin.service");
    const check = await accountAccess.assertPortfolioMutationAccess(
      portfolio._id,
      buildSuperAdminUser()
    );
    expect(check.ok).toBe(true);
    expect(check.isSuperAdmin).toBe(true);
  });

  it("super admin can list all portfolios through admin endpoint", async () => {
    await seedWorkspace();
    const { buildSuperAdminUser } = require("../superAdmin.service");
    mockCurrentUser = buildSuperAdminUser();
    const res = await request(app).get("/api/portfolios/admin");
    expect(res.status).toBe(200);
    expect(res.body.portfolios.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 400 for malformed accountId path param", async () => {
    const res = await request(app).get("/api/accounts/not-an-object-id/members");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ACCOUNT_ID");
  });

  it("returns 400 for malformed X-Account-Id on mine", async () => {
    const res = await request(app)
      .get("/api/portfolios/mine")
      .set("X-Account-Id", "not-valid");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ACCOUNT_ID");
  });

  it("activates invited membership when the user signs up", async () => {
    const { account } = await seedWorkspace();
    const inviteEmail = `invite.${nonce()}@example.test`;
    await AccountMembership.create({
      account: account._id,
      email: inviteEmail,
      role: "editor",
      status: "invited",
    });
    const signup = await request(app).post("/api/auth/signup").send({
      name: "Invited Example",
      username: `inv_${nonce()}`,
      email: inviteEmail,
      password: "synthetic-password",
    });
    expect(signup.status).toBe(201);
    const row = await AccountMembership.findOne({ account: account._id, email: inviteEmail }).lean();
    expect(row.status).toBe("active");
    expect(row.user).toBeTruthy();
  });

  it("blocks demoting the last account admin", async () => {
    const { account } = await seedWorkspace();
    const ownerMembership = await AccountMembership.findOne({
      account: account._id,
      user: OWNER_ID,
    });
    const res = await request(app)
      .patch(`/api/accounts/${account._id}/members/${ownerMembership._id}`)
      .send({ role: "editor" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last account admin/i);
  });

  it("denies super admin on admin portfolios when teams flag is off", async () => {
    process.env.ACCOUNT_TEAMS_ENABLED = "false";
    const { buildSuperAdminUser } = require("../superAdmin.service");
    mockCurrentUser = buildSuperAdminUser();
    const res = await request(app).get("/api/portfolios/admin");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("preserves legacy owner-only access when ACCOUNT_TEAMS_ENABLED is false", async () => {
    process.env.ACCOUNT_TEAMS_ENABLED = "false";
    const portfolio = await Portfolio.create({
      owner: OWNER_ID,
      template: "agent",
      title: "Legacy",
      visibility: "private",
      slug: `legacy-${nonce()}`,
      sections: [],
    });
    mockCurrentUser = {
      _id: EDITOR_ID,
      id: EDITOR_ID,
      role: "customer",
      email: "editor@example.test",
    };
    const res = await request(app).patch(`/api/portfolios/${portfolio._id}`).send({ title: "Nope" });
    expect(res.status).toBe(403);
  });
});