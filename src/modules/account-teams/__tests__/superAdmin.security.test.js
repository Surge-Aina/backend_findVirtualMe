const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authHttpRoutes = require("../../auth/auth.http.routes");
const auth = require("../../../shared/middleware/auth");
const {
  superAdminLoginGlobal,
  superAdminLoginPerIp,
} = require("../superAdminLoginRateLimit");
const { buildSuperAdminUser } = require("../superAdmin.service");

const originalFlag = process.env.ACCOUNT_TEAMS_ENABLED;
const originalEmail = process.env.SUPER_ADMIN_EMAIL;
const originalHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

describe("super admin security", () => {
  const loginApp = express();
  loginApp.use(express.json());
  loginApp.use("/api/auth", authHttpRoutes);

  const scopeApp = express();
  scopeApp.use(express.json());
  scopeApp.get("/api/users/probe", auth, (_req, res) => res.status(200).json({ ok: true }));
  scopeApp.get("/api/portfolios/probe", auth, (_req, res) => res.status(200).json({ ok: true }));

  beforeEach(async () => {
    process.env.ACCOUNT_TEAMS_ENABLED = "true";
    process.env.SUPER_ADMIN_EMAIL = "super@example.test";
    process.env.SUPER_ADMIN_PASSWORD_HASH = await bcrypt.hash("super-secret", 4);
    if (superAdminLoginGlobal.reset) await superAdminLoginGlobal.reset();
    if (superAdminLoginPerIp.reset) await superAdminLoginPerIp.reset();
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.ACCOUNT_TEAMS_ENABLED;
    else process.env.ACCOUNT_TEAMS_ENABLED = originalFlag;
    if (originalEmail === undefined) delete process.env.SUPER_ADMIN_EMAIL;
    else process.env.SUPER_ADMIN_EMAIL = originalEmail;
    if (originalHash === undefined) delete process.env.SUPER_ADMIN_PASSWORD_HASH;
    else process.env.SUPER_ADMIN_PASSWORD_HASH = originalHash;
  });

  it("rate limits super-admin login per IP after five attempts", async () => {
    const payload = { email: "wrong@example.test", password: "nope" };
    for (let i = 0; i < 5; i += 1) {
      const res = await request(loginApp).post("/api/auth/super-admin/login").send(payload);
      expect([401, 404]).toContain(res.status);
    }
    const blocked = await request(loginApp).post("/api/auth/super-admin/login").send(payload);
    expect(blocked.status).toBe(429);
  });

  it("rejects super_admin JWT outside allowlisted API prefixes", async () => {
    const token = jwt.sign(
      { id: buildSuperAdminUser().id, kind: "super_admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const denied = await request(scopeApp)
      .get("/api/users/probe")
      .set("Authorization", `Bearer ${token}`);
    expect(denied.status).toBe(403);

    const allowed = await request(scopeApp)
      .get("/api/portfolios/probe")
      .set("Authorization", `Bearer ${token}`);
    expect(allowed.status).toBe(200);
  });
});