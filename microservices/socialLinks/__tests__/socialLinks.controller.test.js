import request from "supertest";
import app from "../../app.js"; // your Express app
import mongoose from "mongoose";
import SocialLinks from "../socialLinks.model.js";

beforeAll(async () => {
  await mongoose.connect(global.__MONGO_URI__);
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(async () => {
  await SocialLinks.deleteMany({});
});

describe("SocialLinks API", () => {
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
