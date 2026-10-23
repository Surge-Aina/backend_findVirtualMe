jest.mock("pdf-parse", () => jest.fn(async () => ({
  numpages: 1,
  numrender: 1,
  info: {},
  metadata: null,
  text: "Jane Doe software engineer",
})));

jest.mock("../../../shared/services/openAiService", () => ({
  generatePortfolioJSON: jest.fn(async () => JSON.stringify({
    name: "Jane Doe",
    title: "Engineer",
    skills: ["javascript"],
  })),
  generateMatchSummary: jest.fn(async () => "Matched on javascript"),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../../../shared/models/User");
const Portfolio = require("../models/portfolioModel");
const portfolioRoutes = require("../routes/portfolioRoute");
const userRoutes = require("../../../modules/users/users.routes");

const app = express();
app.use(express.json());
app.use("/portfolio", portfolioRoutes);
app.use("/api/users", userRoutes);

const SESSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pdf = Buffer.from("%PDF-1.4\nresume");

function sign(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

describe("pre-login resume upload", () => {
  beforeEach(() => {
    portfolioRoutes.resetOnboardingLimits();
  });

  afterEach(async () => {
    await Portfolio.deleteMany({});
    await User.deleteMany({});
  });

  test("rejects an upload that is not a PDF", async () => {
    const res = await request(app)
      .post("/portfolio/upload-pdf")
      .field("sessionId", SESSION)
      .attach("resume", Buffer.from("not a pdf"), { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
  });

  test("requires a session when the caller is not logged in", async () => {
    const res = await request(app)
      .post("/portfolio/upload-pdf")
      .attach("resume", pdf, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(401);
  });

  test("stores an unclaimed draft and lets signup claim it", async () => {
    const uploaded = await request(app)
      .post("/portfolio/upload-pdf")
      .field("sessionId", SESSION)
      .field("email", "victim@example.com")
      .attach("resume", pdf, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.email).toBe(`onboarding+${SESSION}@onboarding.invalid`);
    expect(uploaded.body.sessionId).toBe(SESSION);
    expect(await Portfolio.countDocuments({ email: "victim@example.com" })).toBe(0);

    const email = `new_user_${Date.now()}@example.com`;
    const signup = await request(app).post("/api/users").send({
      data: {
        userInfo: {
          firstName: "New",
          lastName: "User",
          username: `new_user_${Date.now()}`,
          email,
          password: "password123",
        },
        goal: "job",
        industry: "tech",
        experience: "junior",
        skills: ["javascript"],
        sessionId: SESSION,
      },
    });

    expect(signup.status).toBe(201);
    const claimed = await Portfolio.findById(uploaded.body._id);
    expect(claimed.email).toBe(email);
    expect(String(claimed.userId)).toBe(String(signup.body.user._id));
    expect(claimed.sessionId).toBeNull();
  });

  test("does not overwrite a resume that already belongs to an account", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    await Portfolio.create({
      name: "Owner",
      email: "owner-resume@example.com",
      userId: ownerId,
      sessionId: SESSION,
    });

    const res = await request(app)
      .post("/portfolio/upload-pdf")
      .field("sessionId", SESSION)
      .attach("resume", pdf, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(403);
    const stored = await Portfolio.findOne({ email: "owner-resume@example.com" });
    expect(stored.name).toBe("Owner");
  });

  test("rate limits repeated uploads for the same session", async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post("/portfolio/upload-pdf")
        .field("sessionId", SESSION)
        .attach("resume", pdf, { filename: "resume.pdf", contentType: "application/pdf" });
      expect(res.status).toBe(201);
    }

    const limited = await request(app)
      .post("/portfolio/upload-pdf")
      .field("sessionId", SESSION)
      .attach("resume", pdf, { filename: "resume.pdf", contentType: "application/pdf" });
    expect(limited.status).toBe(429);
  });

  test("an authenticated upload is attached to the caller, not the submitted email", async () => {
    const user = await User.create({
      email: `auth_upload_${Date.now()}@example.com`,
      username: `auth_upload_${Date.now()}`,
      password: await bcrypt.hash("password123", 10),
      userKey: `key_auth_${Date.now()}`,
      practiceId: `practice_auth_${Date.now()}`,
      role: "customer",
    });

    const res = await request(app)
      .post("/portfolio/upload-pdf")
      .set("Authorization", `Bearer ${sign(user)}`)
      .field("email", "victim@example.com")
      .attach("resume", pdf, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(user.email);
    expect(String(res.body.userId)).toBe(String(user._id));
    expect(res.body.sessionId).toBeNull();
  });

  test("ai-summary stays authenticated and is rate limited", async () => {
    const anon = await request(app)
      .post("/portfolio/ai-summary")
      .send({ resumeJSON: { skills: ["js"] }, jobText: "javascript" });
    expect(anon.status).toBe(401);

    const user = await User.create({
      email: `ai_${Date.now()}@example.com`,
      username: `ai_${Date.now()}`,
      password: await bcrypt.hash("password123", 10),
      userKey: `key_ai_${Date.now()}`,
      practiceId: `practice_ai_${Date.now()}`,
      role: "customer",
    });
    const token = sign(user);

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post("/portfolio/ai-summary")
        .set("Authorization", `Bearer ${token}`)
        .send({ resumeJSON: { skills: ["js"] }, jobText: "javascript role" });
      expect(res.status).toBe(200);
      expect(res.body.summary).toBe("Matched on javascript");
    }

    const limited = await request(app)
      .post("/portfolio/ai-summary")
      .set("Authorization", `Bearer ${token}`)
      .send({ resumeJSON: { skills: ["js"] }, jobText: "javascript role" });
    expect(limited.status).toBe(429);
  });
});
