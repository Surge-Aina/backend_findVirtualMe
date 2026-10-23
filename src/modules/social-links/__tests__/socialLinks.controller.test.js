const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const socialLinksRoutes = require("../socialLinks.routes.js");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");

async function ownerContext() {
  const stamp = `${Date.now()}_${Math.random()}`;
  const user = await User.create({
    email: `owner_${stamp}@example.com`,
    username: `owner_${stamp}`,
    password: "password123",
    userKey: `key_${stamp}`,
    practiceId: `practice_${stamp}`,
    role: "customer",
  });
  const portfolio = await Portfolio.create({
    owner: user._id,
    template: "healthcare",
    title: "Links",
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  return { user, portfolio, token };
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/social-links", socialLinksRoutes);
  return app;
}

describe("SocialLinks API", () => {
  const app = createTestApp();

  it("GET /api/social-links/:portfolioId should return 404 if not found", async () => {
    const portfolioId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/social-links/${portfolioId}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /api/social-links/:portfolioId rejects unauthenticated updates", async () => {
    const portfolioId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/social-links/${portfolioId}`)
      .send({ links: { github: "https://github.com/test" } });

    expect(res.status).toBe(401);
  });

  it("PATCH /api/social-links/:portfolioId should create/update links for the owner", async () => {
    const { portfolio, token } = await ownerContext();
    const links = { github: "https://github.com/test" };

    const res = await request(app)
      .patch(`/api/social-links/${portfolio._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ links });

    expect(res.status).toBe(200);
    expect(res.body.links.github).toBe("https://github.com/test");
  });

  it("PATCH /api/social-links/:portfolioId returns 403 for a different user", async () => {
    const { portfolio } = await ownerContext();
    const other = await ownerContext();

    const res = await request(app)
      .patch(`/api/social-links/${portfolio._id}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ links: { github: "https://github.com/other" } });

    expect(res.status).toBe(403);
  });

  it("GET after PATCH should return the saved links", async () => {
    const { portfolio, token } = await ownerContext();
    await request(app)
      .patch(`/api/social-links/${portfolio._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ links: { twitter: "https://twitter.com/test" } });

    const res = await request(app).get(`/api/social-links/${portfolio._id}`);
    expect(res.status).toBe(200);
    expect(res.body.links.twitter).toBe("https://twitter.com/test");
  });
});
