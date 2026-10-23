const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const DomainRoute = require("../../domains/DomainRouter/DomainRouter.model");
const ApiKey = require("../apiKey.model");
const developerKeys = require("../developerKeys.routes");
const { mountPublicApi } = require("../mount");
const { resetPublicApiRateLimits } = require("../rateLimit");
const { hashKey } = require("../apiKey.service");

const app = express();
app.use(express.json());
app.use("/api/developer/api-keys", developerKeys);
mountPublicApi(app);

const originalPepper = process.env.PUBLIC_API_KEY_PEPPER;

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

function sessionFor(user) {
  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "20m",
  });
  return `Bearer ${token}`;
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
    firstName: "Pat",
    lastName: "Example",
    name: "Pat Example",
    phone: "+1-555-014-7788",
  });
}

async function issueKey(user, scopes, name) {
  const res = await request(app)
    .post("/api/developer/api-keys")
    .set("Authorization", sessionFor(user))
    .send({ name, scopes });
  expect(res.status).toBe(201);
  return res.body;
}

function publicGet(path, secret) {
  const req = request(app).get(path);
  if (secret) req.set("Authorization", `Bearer ${secret}`);
  return req;
}

describe("public API v1", () => {
  beforeEach(() => {
    delete process.env.PUBLIC_API_KEY_PEPPER;
    delete process.env.PUBLIC_API_RATE_LIMIT_MAX;
    delete process.env.PUBLIC_API_MAX_ACTIVE_KEYS;
    delete process.env.PUBLIC_SITE_HOST;
    resetPublicApiRateLimits();
  });

  afterAll(() => {
    if (originalPepper === undefined) delete process.env.PUBLIC_API_KEY_PEPPER;
    else process.env.PUBLIC_API_KEY_PEPPER = originalPepper;
  });

  it("creates a key once, stores only a hash, and lists it without the secret", async () => {
    const user = await createUser("owner");
    const created = await issueKey(user, ["sites:read", "profile:read", "sites:read"], "Partner");

    expect(created.secret.startsWith("fvm_")).toBe(true);
    expect(created.data.prefix).toBe(created.secret.slice(0, 12));
    expect(created.data.scopes).toEqual(["sites:read", "profile:read"]);
    expect(created.data.name).toBe("Partner");
    expect(created.data.lastUsedAt).toBeNull();
    expect(created.secret).not.toBe(created.data.prefix);

    const stored = await ApiKey.findById(created.data.id).lean();
    expect(stored.keyHash).toHaveLength(64);
    expect(stored.keyHash).not.toContain(created.secret);
    expect(JSON.stringify(stored)).not.toContain(created.secret);

    const listed = await request(app)
      .get("/api/developer/api-keys")
      .set("Authorization", sessionFor(user));
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).not.toContain(created.secret);
    expect(listed.body.data[0].keyHash).toBeUndefined();
    expect(listed.body.data[0].prefix).toBe(created.data.prefix);

    const other = await createUser("other");
    const otherList = await request(app)
      .get("/api/developer/api-keys")
      .set("Authorization", sessionFor(other));
    expect(otherList.status).toBe(200);
    expect(otherList.body.data).toEqual([]);

    const stolen = await request(app)
      .delete(`/api/developer/api-keys/${created.data.id}`)
      .set("Authorization", sessionFor(other));
    expect(stolen.status).toBe(404);
    expect(stolen.body.error.code).toBe("not_found");
  });

  it("rejects key management without a session and rejects unknown scopes", async () => {
    const missing = await request(app).get("/api/developer/api-keys");
    expect(missing.status).toBe(401);

    const user = await createUser("scopes");
    const bad = await request(app)
      .post("/api/developer/api-keys")
      .set("Authorization", sessionFor(user))
      .send({ scopes: ["sites:write"] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("validation_error");
  });

  it("authenticates the owner, records last use, and rejects missing, foreign, and revoked keys", async () => {
    const user = await createUser("auth");
    const created = await issueKey(user, ["sites:read"], "Primary");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const me = await publicGet("/api/public/v1/me", created.secret);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({
      id: user._id.toString(),
      username: user.username,
      role: "customer",
      active: true,
    });
    expect(JSON.stringify(me.body)).not.toContain(user.email);
    expect(JSON.stringify(me.body)).not.toContain(user.phone);
    expect(JSON.stringify(me.body)).not.toContain("Pat Example");
    expect(me.headers["ratelimit-limit"]).toBeDefined();

    const listed = await request(app)
      .get("/api/developer/api-keys")
      .set("Authorization", sessionFor(user));
    expect(listed.body.data[0].lastUsedAt).toEqual(expect.any(String));

    const missing = await publicGet("/api/public/v1/me");
    expect(missing.status).toBe(401);
    expect(missing.body.error).toEqual({
      code: "invalid_api_key",
      message: "Invalid or revoked API key",
    });

    const sessionToken = sessionFor(user).slice("Bearer ".length);
    const jwtAttempt = await publicGet("/api/public/v1/me", sessionToken);
    expect(jwtAttempt.status).toBe(401);
    expect(jwtAttempt.body.error.code).toBe("invalid_api_key");

    const revoked = await request(app)
      .delete(`/api/developer/api-keys/${created.data.id}`)
      .set("Authorization", sessionFor(user));
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.revokedAt).toEqual(expect.any(String));

    const again = await request(app)
      .delete(`/api/developer/api-keys/${created.data.id}`)
      .set("Authorization", sessionFor(user));
    expect(again.status).toBe(200);

    const after = await publicGet("/api/public/v1/me", created.secret);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("invalid_api_key");

    const logs = JSON.stringify(errorSpy.mock.calls);
    expect(logs).not.toContain(created.secret);
    expect(logs).not.toContain(sessionToken);
    expect(logs).not.toContain(user.email);
    expect(logs).not.toContain(user.phone);
    expect(logs).not.toContain("Pat Example");
  });

  it("rotates a key and stops accepting the previous secret", async () => {
    const user = await createUser("rotate");
    const created = await issueKey(user, ["profile:read"], "Rotate me");
    const rotated = await request(app)
      .post(`/api/developer/api-keys/${created.data.id}/rotate`)
      .set("Authorization", sessionFor(user));

    expect(rotated.status).toBe(201);
    expect(rotated.body.revokedKeyId).toBe(created.data.id);
    expect(rotated.body.secret).not.toBe(created.secret);
    expect(rotated.body.data.scopes).toEqual(["profile:read"]);
    expect(rotated.body.data.prefix).toBe(rotated.body.secret.slice(0, 12));

    const oldCall = await publicGet("/api/public/v1/me", created.secret);
    expect(oldCall.status).toBe(401);
    const newCall = await publicGet("/api/public/v1/me", rotated.body.secret);
    expect(newCall.status).toBe(200);

    const listed = await request(app)
      .get("/api/developer/api-keys")
      .set("Authorization", sessionFor(user));
    const previous = listed.body.data.find((key) => key.id === created.data.id);
    expect(previous.revokedAt).toEqual(expect.any(String));
    expect(previous.replacedBy).toBe(rotated.body.data.id);
    expect(JSON.stringify(listed.body)).not.toContain(rotated.body.secret);
  });

  it("enforces scopes and keeps each tenant on their own sites", async () => {
    const owner = await createUser("sites");
    const stranger = await createUser("stranger");
    const slug = `northwind${nonce()}`;
    const contactEmail = `desk.${nonce()}@example.test`;
    const draftEmail = `draft.${nonce()}@example.test`;

    const published = await Portfolio.create({
      owner: owner._id,
      slug,
      title: "Northwind Clinic",
      template: "healthcare",
      visibility: "public",
      themeTokens: {
        accent: "#112233",
        accentStrong: "#445566",
        note: "do-not-leak-token",
      },
      sections: [
        {
          type: "hero",
          order: 0,
          visible: true,
          data: {
            practiceName: "Northwind Clinic",
            logoImage: "https://cdn.example.test/logo.png",
            phone: "(555) 010-2020",
          },
        },
        {
          type: "contact",
          order: 1,
          visible: true,
          data: {
            email: contactEmail,
            phone: "+1-555-010-9999",
            address: {
              street: "100 Synthetic Ave",
              city: "Austin",
              state: "TX",
              zip: "78701",
            },
          },
        },
      ],
    });

    const draft = await Portfolio.create({
      owner: owner._id,
      slug: `draft${nonce()}`,
      title: "Draft Only Studio",
      template: "agent",
      visibility: "private",
      sections: [
        {
          type: "summary",
          order: 0,
          visible: true,
          data: { name: "Draft Only Studio", email: draftEmail, phone: "555-0199" },
        },
      ],
    });

    const foreign = await Portfolio.create({
      owner: stranger._id,
      slug: `foreign${nonce()}`,
      title: "Other Clinic",
      template: "healthcare",
      visibility: "public",
    });

    await User.updateOne(
      { _id: owner._id },
      {
        $push: {
          domains: {
            domain: "Northwind.Example",
            portfolioId: published._id.toString(),
            type: "byod",
            status: "active",
          },
        },
      }
    );
    await DomainRoute.create({
      domain: "alias.example",
      userId: owner._id,
      portfolioId: published._id,
      isActive: true,
    });
    await DomainRoute.create({
      domain: "stranger.example",
      userId: stranger._id,
      portfolioId: foreign._id,
      isActive: true,
    });

    const sitesKey = await issueKey(owner, ["sites:read"], "Sites");
    const profileKey = await issueKey(owner, ["profile:read"], "Profile");

    const deniedSites = await publicGet("/api/public/v1/sites", profileKey.secret);
    expect(deniedSites.status).toBe(403);
    expect(deniedSites.body.error).toMatchObject({
      code: "insufficient_scope",
      details: { requiredScope: "sites:read" },
    });

    const deniedProfile = await publicGet("/api/public/v1/business-profile", sitesKey.secret);
    expect(deniedProfile.status).toBe(403);
    expect(deniedProfile.body.error.details.requiredScope).toBe("profile:read");

    const page = await publicGet("/api/public/v1/sites?limit=1", sitesKey.secret);
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.page).toMatchObject({ limit: 1, hasMore: true });
    expect(typeof page.body.page.nextCursor).toBe("string");

    const rest = await publicGet(
      `/api/public/v1/sites?limit=10&cursor=${page.body.page.nextCursor}`,
      sitesKey.secret
    );
    expect(rest.status).toBe(200);
    const ids = [...page.body.data, ...rest.body.data].map((site) => site.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toEqual(expect.arrayContaining([published._id.toString(), draft._id.toString()]));
    expect(ids).not.toContain(foreign._id.toString());

    const publishedSite = [...page.body.data, ...rest.body.data].find(
      (site) => site.id === published._id.toString()
    );
    expect(publishedSite).toMatchObject({
      subdomain: slug,
      hostname: `${slug}.findvirtual.me`,
      published: true,
      domains: expect.arrayContaining([
        { domain: "northwind.example", status: "active" },
        { domain: "alias.example", status: "active" },
      ]),
    });
    expect(publishedSite.domains).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ domain: "stranger.example" })])
    );
    expect(JSON.stringify(publishedSite)).not.toContain(contactEmail);

    const own = await publicGet(`/api/public/v1/sites/${published._id}`, sitesKey.secret);
    expect(own.status).toBe(200);
    expect(own.body.data.id).toBe(published._id.toString());

    const cross = await publicGet(`/api/public/v1/sites/${foreign._id}`, sitesKey.secret);
    expect(cross.status).toBe(404);
    expect(cross.body.error.code).toBe("not_found");

    const badCursor = await publicGet("/api/public/v1/sites?cursor=not-a-cursor", sitesKey.secret);
    expect(badCursor.status).toBe(400);
    expect(badCursor.body.error.code).toBe("validation_error");

    const profile = await publicGet("/api/public/v1/business-profile", profileKey.secret);
    expect(profile.status).toBe(200);
    expect(profile.body.data).toMatchObject({
      siteId: published._id.toString(),
      businessName: "Northwind Clinic",
      logoUrl: "https://cdn.example.test/logo.png",
      brandColors: { accent: "#112233", accentStrong: "#445566" },
      address: {
        line1: "100 Synthetic Ave",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
      },
    });
    const profileJson = JSON.stringify(profile.body);
    expect(profileJson).not.toContain(contactEmail);
    expect(profileJson).not.toContain(draftEmail);
    expect(profileJson).not.toContain("(555) 010-2020");
    expect(profileJson).not.toContain("+1-555-010-9999");
    expect(profileJson).not.toContain("555-0199");
    expect(profileJson).not.toContain(owner.phone);
    expect(profileJson).not.toContain(owner.email);
    expect(profileJson).not.toContain("Pat Example");
    expect(profileJson).not.toContain("do-not-leak-token");

    const foreignProfile = await publicGet(
      `/api/public/v1/business-profile?siteId=${foreign._id}`,
      profileKey.secret
    );
    expect(foreignProfile.status).toBe(404);

    const draftProfile = await publicGet(
      `/api/public/v1/business-profile?siteId=${draft._id}`,
      profileKey.secret
    );
    expect(draftProfile.status).toBe(200);
    expect(draftProfile.body.data.businessName).toBe("Draft Only Studio");
    expect(JSON.stringify(draftProfile.body)).not.toContain(draftEmail);
  });

  it("rate limits one key without blocking a different key", async () => {
    process.env.PUBLIC_API_RATE_LIMIT_MAX = "2";
    resetPublicApiRateLimits();
    const user = await createUser("rate");
    const first = await issueKey(user, ["sites:read"], "One");
    const second = await issueKey(user, ["sites:read"], "Two");

    expect((await publicGet("/api/public/v1/me", first.secret)).status).toBe(200);
    expect((await publicGet("/api/public/v1/me", first.secret)).status).toBe(200);
    const limited = await publicGet("/api/public/v1/me", first.secret);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limited");
    expect(limited.headers["retry-after"]).toBeDefined();

    const other = await publicGet("/api/public/v1/me", second.secret);
    expect(other.status).toBe(200);
  });

  it("stops at the active key limit and still allows rotation", async () => {
    process.env.PUBLIC_API_MAX_ACTIVE_KEYS = "1";
    const user = await createUser("limit");
    const created = await issueKey(user, ["sites:read"], "Only");
    const extra = await request(app)
      .post("/api/developer/api-keys")
      .set("Authorization", sessionFor(user))
      .send({ scopes: ["sites:read"] });
    expect(extra.status).toBe(409);
    expect(extra.body.error.code).toBe("key_limit");

    const rotated = await request(app)
      .post(`/api/developer/api-keys/${created.data.id}/rotate`)
      .set("Authorization", sessionFor(user));
    expect(rotated.status).toBe(201);
  });

  it("rejects an inactive account", async () => {
    const user = await createUser("inactive");
    const created = await issueKey(user, ["sites:read"], "Paused");
    user.isActive = false;
    await user.save();

    const res = await publicGet("/api/public/v1/me", created.secret);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("account_inactive");
  });

  it("changes the hash when the pepper changes", async () => {
    const plain = "fvm_synthetic_example";
    const unsalted = hashKey(plain);
    process.env.PUBLIC_API_KEY_PEPPER = "pepper-a";
    const first = hashKey(plain);
    process.env.PUBLIC_API_KEY_PEPPER = "pepper-b";
    const second = hashKey(plain);
    expect(unsalted).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(unsalted);
    expect(second).not.toBe(first);
    expect(first).not.toContain(plain);
  });

  it("serves the OpenAPI document and the docs page without a key", async () => {
    const spec = await request(app).get("/api/public/v1/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.1.0");
    expect(spec.body.paths["/me"]).toBeDefined();
    expect(spec.body.paths["/sites"]).toBeDefined();
    expect(spec.body.paths["/sites/{id}"]).toBeDefined();
    expect(spec.body.paths["/business-profile"]).toBeDefined();
    expect(spec.body.components.securitySchemes.bearerAuth.scheme).toBe("bearer");

    const docs = await request(app).get("/api/public/docs");
    expect(docs.status).toBe(200);
    expect(docs.headers["content-type"]).toMatch(/html/);
    expect(docs.text).toContain("profile:read");
    expect(docs.text).toContain("sites:read");
    expect(docs.text).toContain("/api/public/v1/openapi.json");
    expect(docs.text).toContain("lead.captured");
  });
});
