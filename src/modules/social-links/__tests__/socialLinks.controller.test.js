const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const socialLinksRoutes = require("../socialLinks.routes.js");

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

  it("PATCH /api/social-links/:portfolioId should create/update links", async () => {
    const portfolioId = new mongoose.Types.ObjectId();
    const links = { github: "https://github.com/test" };

    const res = await request(app)
      .patch(`/api/social-links/${portfolioId}`)
      .send({ links });

    expect(res.status).toBe(200);
    expect(res.body.links.github).toBe("https://github.com/test");
  });

  it("GET after PATCH should return the saved links", async () => {
    const portfolioId = new mongoose.Types.ObjectId();
    await request(app)
      .patch(`/api/social-links/${portfolioId}`)
      .send({ links: { twitter: "https://twitter.com/test" } });

    const res = await request(app).get(`/api/social-links/${portfolioId}`);
    expect(res.status).toBe(200);
    expect(res.body.links.twitter).toBe("https://twitter.com/test");
  });
});
