const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { generateKeyPair, exportSPKI, SignJWT } = require("jose");
const User = require("../../../../shared/models/User");
const authHttpRoutes = require("../../auth.http.routes");
const { resetHandoffKeyCache } = require("../bagglemeHandoff.service");

describe("POST /api/auth/baggleme", () => {
  let app;
  let privateKey;
  let publicKeyPem;
  let otherPrivateKey;
  let pinnedUser;

  const ENV_KEYS = [
    "BAGGLEME_HANDOFF_ENABLED",
    "BAGGLEME_HANDOFF_PUBLIC_KEY",
    "BAGGLEME_HANDOFF_USER_ID",
  ];

  function saveEnv() {
    const saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
    }
    return saved;
  }

  function restoreEnv(saved) {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetHandoffKeyCache();
  }

  async function signHandoffToken(overrides = {}, key = privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      sub: pinnedUser._id.toString(),
      jti: crypto.randomBytes(16).toString("hex"),
      exp: now + 60,
      ...overrides,
    };
    const builder = new SignJWT({ jti: claims.jti })
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuer("baggleme")
      .setAudience("fvm")
      .setSubject(claims.sub)
      .setExpirationTime(claims.exp);

    return builder.sign(key);
  }

  beforeAll(async () => {
    const pair = await generateKeyPair("EdDSA", { extractable: true });
    privateKey = pair.privateKey;
    publicKeyPem = await exportSPKI(pair.publicKey);

    const otherPair = await generateKeyPair("EdDSA", { extractable: true });
    otherPrivateKey = otherPair.privateKey;
  });

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/auth", authHttpRoutes);

    const password = await bcrypt.hash("synthetic-pass", 4);
    pinnedUser = await User.create({
      username: `handoff-admin-${Date.now()}`,
      email: `handoff-admin-${Date.now()}@example.test`,
      name: "Handoff Admin",
      password,
      authProvider: "local",
      role: "admin",
      portfolios: [
        {
          portfolioId: new mongoose.Types.ObjectId(),
          portfolioType: "Handyman",
        },
      ],
    });
  });

  it("returns 404 when the feature flag is off (same as unknown route)", async () => {
    const saved = saveEnv();
    delete process.env.BAGGLEME_HANDOFF_ENABLED;
    delete process.env.BAGGLEME_HANDOFF_PUBLIC_KEY;
    delete process.env.BAGGLEME_HANDOFF_USER_ID;

    const disabled = await request(app)
      .post("/api/auth/baggleme")
      .send({ token: "x" });

    expect(disabled.status).toBe(404);
    expect(disabled.text).toContain("Cannot POST");
    expect(disabled.headers["content-type"]).toMatch(/html/);
    expect(disabled.body).toEqual({});

    restoreEnv(saved);
  });

  describe("with handoff enabled", () => {
    let savedEnv;

    beforeEach(() => {
      savedEnv = saveEnv();
      process.env.BAGGLEME_HANDOFF_ENABLED = "true";
      process.env.BAGGLEME_HANDOFF_PUBLIC_KEY = publicKeyPem;
      process.env.BAGGLEME_HANDOFF_USER_ID = pinnedUser._id.toString();
      resetHandoffKeyCache();
    });

    afterEach(() => {
      if (savedEnv) restoreEnv(savedEnv);
    });

    it("accepts a valid token and returns login payload", async () => {
      const token = await signHandoffToken();

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(200);

      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.portfolioIds).toHaveLength(1);
      expect(res.body.portfolioIds[0].portfolioType).toBe("Handyman");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user._id.toString()).toBe(pinnedUser._id.toString());
      expect(res.body.message).toBe("logged in successfully");
    });

    it("rejects HS256 token signed with the PEM as secret", async () => {
      const bad = jwt.sign(
        {
          sub: pinnedUser._id.toString(),
          jti: crypto.randomBytes(8).toString("hex"),
          iss: "baggleme",
          aud: "fvm",
        },
        publicKeyPem,
        { algorithm: "HS256", expiresIn: "60s" },
      );

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token: bad })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects alg none tokens", async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: pinnedUser._id.toString(),
          jti: crypto.randomBytes(8).toString("hex"),
          iss: "baggleme",
          aud: "fvm",
          exp: Math.floor(Date.now() / 1000) + 60,
        }),
      ).toString("base64url");
      const token = `${header}.${payload}.`;

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects bad signature / other key", async () => {
      const token = await signHandoffToken({}, otherPrivateKey);

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects wrong iss", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({
        jti: crypto.randomBytes(8).toString("hex"),
      })
        .setProtectedHeader({ alg: "EdDSA" })
        .setIssuer("other")
        .setAudience("fvm")
        .setSubject(pinnedUser._id.toString())
        .setExpirationTime(now + 60)
        .sign(privateKey);

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects wrong aud", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({
        jti: crypto.randomBytes(8).toString("hex"),
      })
        .setProtectedHeader({ alg: "EdDSA" })
        .setIssuer("baggleme")
        .setAudience("other")
        .setSubject(pinnedUser._id.toString())
        .setExpirationTime(now + 60)
        .sign(privateKey);

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects expired token beyond skew", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signHandoffToken({ exp: now - 10 });

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects exp too far in the future", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signHandoffToken({ exp: now + 200 });

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects missing jti", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "EdDSA" })
        .setIssuer("baggleme")
        .setAudience("fvm")
        .setSubject(pinnedUser._id.toString())
        .setExpirationTime(now + 60)
        .sign(privateKey);

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects sub that does not match pinned user id", async () => {
      const token = await signHandoffToken({
        sub: "507f1f77bcf86cd799439011",
      });

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("rejects replayed jti", async () => {
      const jti = crypto.randomBytes(16).toString("hex");
      const token = await signHandoffToken({ jti });

      const first = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(200);

      expect(first.body.token).toBeDefined();

      const second = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(second.body).toEqual({ message: "Invalid handoff" });
    });

    it("fails closed when public key env is missing", async () => {
      delete process.env.BAGGLEME_HANDOFF_PUBLIC_KEY;
      resetHandoffKeyCache();

      const token = await signHandoffToken();

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(401);

      expect(res.body).toEqual({ message: "Invalid handoff" });
    });

    it("handles literal \\n in public key env", async () => {
      process.env.BAGGLEME_HANDOFF_PUBLIC_KEY = publicKeyPem.replace(
        /\n/g,
        "\\n",
      );
      resetHandoffKeyCache();

      const token = await signHandoffToken();

      const res = await request(app)
        .post("/api/auth/baggleme")
        .send({ token })
        .expect(200);

      expect(res.body.token).toBeDefined();
    });
  });
});