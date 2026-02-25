jest.mock("../DomainRouter.model");
jest.mock("../utils/domainHelpers");

const DomainRoute = require("../DomainRouter.model");
const { normalizeDomain, getPortfolioMeta } = require("../utils/domainHelpers");
const { createDomainMapping } = require("../DomainRouter.service");

const mockUser = {
  _id: "user123",
  portfolios: [{ portfolioId: "port1", portfolioType: "photographer" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  normalizeDomain.mockImplementation((d) => d.toLowerCase());
});

describe("createDomainMapping", () => {
  test("throws if domain is missing", async () => {
    await expect(createDomainMapping({ user: mockUser })).rejects.toThrow("Domain is required");
  });

  test("throws 409 if domain already mapped", async () => {
    DomainRoute.findOne.mockResolvedValue({ domain: "example.com" });

    await expect(
      createDomainMapping({ domain: "example.com", user: mockUser })
    ).rejects.toMatchObject({ message: "Domain already mapped", status: 409 });
  });

  test("throws 403 if user does not own portfolio", async () => {
    DomainRoute.findOne.mockResolvedValue(null);
    getPortfolioMeta.mockReturnValue(null); // portfolio not found on user

    await expect(
      createDomainMapping({ domain: "example.com", user: mockUser, portfolioId: "port999" })
    ).rejects.toMatchObject({ message: "You do not own this portfolio", status: 403 });
  });

  test("creates mapping successfully without portfolioId", async () => {
    DomainRoute.findOne.mockResolvedValue(null);
    DomainRoute.create.mockResolvedValue({ domain: "example.com", userId: "user123" });

    const result = await createDomainMapping({ domain: "example.com", user: mockUser });

    expect(DomainRoute.create).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "example.com", userId: "user123" })
    );
    expect(result.domain).toBe("example.com");
  });

  test("creates mapping with portfolioId when user owns it", async () => {
    DomainRoute.findOne.mockResolvedValue(null);
    DomainRoute.create.mockResolvedValue({ domain: "example.com" });
    getPortfolioMeta.mockReturnValue({ portfolioType: "photographer" });

    await createDomainMapping({
      domain: "example.com",
      user: mockUser,
      portfolioId: "port1",
    });

    expect(DomainRoute.create).toHaveBeenCalledWith(
      expect.objectContaining({ portfolioId: "port1", portfolioType: "photographer" })
    );
  });
});