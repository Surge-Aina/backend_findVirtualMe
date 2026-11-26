jest.mock("../../models/User", () => ({
  exists: jest.fn().mockResolvedValue(false),
}));

jest.mock("cors", () => jest.fn((options) => options));

const User = require("../../models/User");
const cors = require("cors");
const corsOptions = require("../cors.middleware");

describe("cors.middleware platform subdomains", () => {
  it("allows https customer platform origins without a DB lookup", async () => {
    const callback = jest.fn();
    corsOptions.origin("https://customer-slug.findvirtual.me", callback);

    expect(callback).toHaveBeenCalledWith(null, true);
    expect(User.exists).not.toHaveBeenCalled();
  });

  it("blocks unrelated https origins", async () => {
    User.exists.mockResolvedValueOnce(false);
    const callback = jest.fn();

    corsOptions.origin("https://evilfindvirtual.me", callback);
    await new Promise((resolve) => setImmediate(resolve));

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
    expect(User.exists).toHaveBeenCalled();
  });

  it("keeps credentials enabled", () => {
    expect(cors.lastOptions?.credentials ?? corsOptions.credentials).toBe(true);
  });
});