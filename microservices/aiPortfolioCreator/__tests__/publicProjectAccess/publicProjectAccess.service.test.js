const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../../../../models/User");
const pubProjServ = require("../../publicProjectsAccess/publicProjectsAccess.service");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany(); // clean database between tests
});

describe("Public Projects Service with MongoMemoryServer", () => {
  it("should return all public projects across users", async () => {
    await User.create([
      {
        username: "user1",
        email: "u1@test.com",
        password: "pass",
        projects: [
          { projectId: "p1", isPublic: true },
          { projectId: "p2", isPublic: false },
        ],
      },
      {
        username: "user2",
        email: "u2@test.com",
        password: "pass",
        projects: [{ projectId: "p3", isPublic: true }],
      },
    ]);

    const projects = await pubProjServ.getPublicProjects();
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.project.projectId)).toEqual(
      expect.arrayContaining(["p1", "p3"])
    );
  });

  it("should return public projects for a specific user", async () => {
    const user = await User.create({
      username: "user3",
      email: "u3@test.com",
      password: "pass",
      projects: [
        { projectId: "p1", isPublic: true },
        { projectId: "p2", isPublic: false },
      ],
    });

    const publicProjects = await pubProjServ.getPublicProjectsFromUser(user._id);
    expect(publicProjects).toHaveLength(1);
    expect(publicProjects[0].projectId).toBe("p1");
  });

  it("should toggle project isPublic status", async () => {
    const user = await User.create({
      username: "user4",
      email: "u4@test.com",
      password: "pass",
      projects: [{ projectId: "p1", isPublic: false }],
    });

    const updatedProject = await pubProjServ.togglePublicProjectStatus(user, "p1");
    expect(updatedProject.isPublic).toBe(true);

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.projects[0].isPublic).toBe(true);
  });
});
