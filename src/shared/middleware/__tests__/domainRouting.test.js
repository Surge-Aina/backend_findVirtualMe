jest.mock("../../../modules/domains/DomainRouter/DomainRouter.model", () => ({
  findOne: jest.fn(),
}));

const DomainRouter = require("../../../modules/domains/DomainRouter/DomainRouter.model");
const domainRouting = require("../domainRouting");

describe("domainRouting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets domainContext when route found", async () => {
    DomainRouter.findOne.mockResolvedValue({
      portfolioId: "p1",
    });

    const req = { hostname: "custom.example.com", originalUrl: "/" };
    const next = jest.fn();

    await domainRouting(req, {}, next);

    expect(req.domainContext).toEqual({
      domain: "custom.example.com",
      portfolioId: "p1",
    });
    expect(next).toHaveBeenCalled();
  });

  it("sets domainContext null when not found", async () => {
    DomainRouter.findOne.mockResolvedValue(null);

    const req = { hostname: "x.com", originalUrl: "/" };
    const next = jest.fn();

    await domainRouting(req, {}, next);

    expect(req.domainContext).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it("calls next on error", async () => {
    DomainRouter.findOne.mockRejectedValue(new Error("db"));

    const req = { hostname: "x.com", originalUrl: "/" };
    const next = jest.fn();

    await domainRouting(req, {}, next);

    expect(next).toHaveBeenCalled();
  });
});
