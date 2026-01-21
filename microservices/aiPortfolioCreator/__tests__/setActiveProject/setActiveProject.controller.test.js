// __tests__/setActiveProject.controller.test.js
const express = require("express");
const request = require("supertest");
const {
  setActiveProject,
} = require("../../setActiveProject/setActiveProject.controller");
const { userUtils } = require("../../utils/aiPortfolioCreator.utils");

jest.mock("../../utils/aiPortfolioCreator.utils");

const app = express();
app.use(express.json());
app.post("/project/:projectId", setActiveProject);

describe("POST /project/:projectId", () => {
  beforeEach(() => jest.clearAllMocks());

  test("should set active project successfully", async () => {
    const mockUser = {
      projects: [{ projectId: "123", status: "active" }],
      save: jest.fn(),
    };
    userUtils.getOrCreateUser.mockResolvedValue(mockUser);

    const res = await request(app).post("/project/123");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.activeProjectId).toBe("123");
    expect(mockUser.save).toHaveBeenCalled();
  });

  test("should return 404 if project not found", async () => {
    const mockUser = { projects: [], save: jest.fn() };
    userUtils.getOrCreateUser.mockResolvedValue(mockUser);

    const res = await request(app).post("/project/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test("should return 400 if user does not exist", async () => {
    userUtils.getOrCreateUser.mockRejectedValue(
      new Error("User not found. Please create an account first.")
    );

    const res = await request(app).post("/project/123");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/create an account/i);
  });
});
