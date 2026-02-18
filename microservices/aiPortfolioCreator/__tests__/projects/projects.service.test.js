// tests/projects.service.test.js
const projectService = require("../../projects/projects.service");
const { helpers } = require("../../utils/aiPortfolioCreator.utils");

jest.mock("../../utils/aiPortfolioCreator.utils", () => ({
  helpers: {
    newProjectId: jest.fn(() => "123"),
    projectToClient: jest.fn((p) => p),
  },
}));

describe("Project Service", () => {
  let mockUser;

  beforeEach(() => {
    mockUser = {
      projects: [],
      activeProjectId: "",
      save: jest.fn(),
    };
  });

  test("addProject should create and return new project", async () => {
    const result = await projectService.addProject("Test Project", mockUser);
    expect(result.project.name).toBe("Test Project");
    expect(mockUser.save).toHaveBeenCalled();
  });

  test("getProjects should filter deleted projects", async () => {
    mockUser.projects = [
      { projectId: "1", status: "active" },
      { projectId: "2", status: "deleted" },
    ];
    const result = await projectService.getProjects(mockUser);
    expect(result).toHaveLength(1);
  });

  test("getProjectById returns null if not found", async () => {
    mockUser.projects = [];
    const res = await projectService.getProjectById("999", mockUser);
    expect(res).toBeNull();
  });

  test("deleteProject should mark project as deleted", async () => {
    mockUser.projects = [{ projectId: "123", status: "active" }];
    const res = await projectService.deleteProject("123", mockUser);
    expect(res).toBe(true);
    expect(mockUser.projects[0].status).toBe("deleted");
  });

  test("addProject should not share default template references", async () => {
    // Project A
    helpers.newProjectId.mockReturnValueOnce("projA");
    await projectService.addProject("A", mockUser);
    const projA = mockUser.projects.find((p) => p.projectId === "projA");

    // Mutate A's template lines (simulating edits)
    projA.frontendJson.lines["5"] = "<title>CHANGED</title>";

    // Project B must still have pristine defaults
    helpers.newProjectId.mockReturnValueOnce("projB");
    await projectService.addProject("B", mockUser);
    const projB = mockUser.projects.find((p) => p.projectId === "projB");

    expect(projB.frontendJson.lines["5"]).toBe("    <title>Name Saver</title>");
  });
});
