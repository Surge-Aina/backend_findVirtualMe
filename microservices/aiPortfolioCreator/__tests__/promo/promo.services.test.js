const promoService = require("../../promo/promo.service");
const { userUtils, helpers } = require("../../utils/aiPortfolioCreator.utils");

global.fetch = jest.fn();

jest.mock("../../utils/aiPortfolioCreator.utils", () => ({
  userUtils: { getOrCreateUser: jest.fn() },
  helpers: {
    linesToTextFromObj: jest.fn(() => "file content"),
    projectToClient: jest.fn((p) => ({ id: p.projectId })),
  },
}));

describe("Promo Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "fake-key";
  });

  test("should throw error for invalid params", async () => {
    await expect(
      promoService.createPromo({ projectId: "", target: "wrong" })
    ).rejects.toThrow("Invalid projectId or target");
  });

  test("should throw error if project not found", async () => {
    userUtils.getOrCreateUser.mockResolvedValue({ projects: [], activeProjectId: "1" });
    await expect(
      promoService.createPromo({ projectId: "1", target: "frontend" })
    ).rejects.toThrow("Project not found");
  });

  test("should process successful response", async () => {
    const proj = {
      projectId: "1",
      status: "active",
      frontendJson: { lines: {} },
      backendJson: { lines: {} },
    };
    const save = jest.fn();
    userUtils.getOrCreateUser.mockResolvedValue({
      projects: [proj],
      save,
    });

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ tweet: "Hi!", frontendLines: { 1: "line" } }),
            },
          },
        ],
      }),
    });

    const result = await promoService.createPromo({
      projectId: "1",
      target: "frontend",
      prompt: "tweet it",
    });

    expect(result.ok).toBe(true);
    expect(result.tweet).toBe("Hi!");
    expect(save).toHaveBeenCalled();
  });
});
