const { userUtils } = require("../../utils/aiPortfolioCreator.utils");
const nameService = require("../../name/name.service");

jest.mock("../../utils/aiPortfolioCreator.utils", () => ({
  userUtils: { getOrCreateUser: jest.fn() },
}));

describe("Name Service", () => {
  afterEach(() => jest.clearAllMocks());

  test("should return project name", async () => {
    userUtils.getOrCreateUser.mockResolvedValue({
      activeProjectId: "1",
      projects: [
        { projectId: "1", status: "active", dataJson: { name: "Test Project" } },
      ],
    });

    const result = await nameService.getName();
    expect(result).toBe("Test Project");
  });

  test("should throw error if no active project on update", async () => {
    userUtils.getOrCreateUser.mockResolvedValue({
      activeProjectId: "1",
      projects: [],
    });

    await expect(nameService.updateName("New Name")).rejects.toThrow("No active project");
  });

  test("should update project name", async () => {
    const save = jest.fn();
    const proj = {
      projectId: "1",
      status: "active",
      dataJson: { name: "" },
    };

    userUtils.getOrCreateUser.mockResolvedValue({
      activeProjectId: "1",
      projects: [proj],
      save,
    });

    const result = await nameService.updateName("Updated");
    expect(result).toBe("Updated");
    expect(proj.dataJson.name).toBe("Updated");
    expect(save).toHaveBeenCalled();
  });
});
