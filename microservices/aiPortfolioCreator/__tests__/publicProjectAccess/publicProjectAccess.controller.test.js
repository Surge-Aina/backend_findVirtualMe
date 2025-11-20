const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../../../../models/User");
const controller = require("../../publicProjectsAccess/publicProjectsAccess.controller");
const bodyParser = require("body-parser");
const request = require("supertest");

let app;
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  app = express();
  app.use(bodyParser.json());

  app.get("/public-projects", controller.getPublicProjects);
  app.get("/user/:userId/projects", controller.getPublicProjectsFromUser);
  app.post("/user/:projectId/toggle", (req, res) => {
    req.user = req.body.user; // mock auth middleware
    controller.togglePublicStatus(req, res);
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany();
});

describe("Public Projects Controller with MongoMemoryServer", () => {
  it("GET /public-projects returns all public projects", async () => {
    await User.create([
      {
        username: "u1",
        email: "u1@test.com",
        password: "pass",
        projects: [{ projectId: "p1", isPublic: true }],
      },
      {
        username: "u2",
        email: "u2@test.com",
        password: "pass",
        projects: [{ projectId: "p2", isPublic: false }],
      },
    ]);

    const res = await request(app).get("/public-projects");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].project.projectId).toBe("p1");
  });

  it("GET /user/:userId/projects returns user's public projects", async () => {
    const user = await User.create({
      username: "user3",
      email: "u3@test.com",
      password: "pass",
      projects: [
        { projectId: "p1", isPublic: true },
        { projectId: "p2", isPublic: false },
      ],
    });

    const res = await request(app).get(`/user/${user._id}/projects`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].projectId).toBe("p1");
  });

  it("POST /user/:projectId/toggle toggles project status", async () => {
    const user = await User.create({
      username: "user4",
      email: "u4@test.com",
      password: "pass",
      projects: [{ projectId: "p1", isPublic: false }],
    });

    const res = await request(app)
      .post(`/user/p1/toggle`)
      .send({ user: { _id: user._id } });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.project.isPublic).toBe(true);

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.projects[0].isPublic).toBe(true);
  });
});
