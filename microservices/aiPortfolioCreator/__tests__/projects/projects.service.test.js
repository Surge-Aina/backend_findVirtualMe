// tests/projects.service.test.js
const projectService = require("../../projects/projects.service");
const { userUtils, helpers } = require("../../utils/aiPortfolioCreator.utils");

jest.mock("../../utils/aiPortfolioCreator.utils", () => ({
  userUtils: { getOrCreateUser: jest.fn() },
  helpers: { newProjectId: jest.fn(() => "123"), projectToClient: jest.fn((p) => p) },
}));

describe("Project Service", () => {
  let mockUser;

  beforeEach(() => {
    mockUser = {
      projects: [],
      activeProjectId: "",
      save: jest.fn(),
    };
    userUtils.getOrCreateUser.mockResolvedValue(mockUser);
  });

  test("addProject should create and return new project", async () => {
    const result = await projectService.addProject("Test Project");
    expect(result.project.name).toBe("Test Project");
    expect(mockUser.save).toHaveBeenCalled();
  });

  test("getProjects should filter deleted projects", async () => {
    mockUser.projects = [
      { projectId: "1", status: "active" },
      { projectId: "2", status: "deleted" },
    ];
    const result = await projectService.getProjects();
    expect(result).toHaveLength(1);
  });

  test("getProjectById returns null if not found", async () => {
    mockUser.projects = [];
    const res = await projectService.getProjectById("999");
    expect(res).toBeNull();
  });

  test("deleteProject should mark project as deleted", async () => {
    mockUser.projects = [{ projectId: "123", status: "active" }];
    const res = await projectService.deleteProject("123");
    expect(res).toBe(true);
    expect(mockUser.projects[0].status).toBe("deleted");
  });
});
