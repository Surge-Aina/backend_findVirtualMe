const roleCheck = require("../../middleware/roleCheck");

describe("roleCheck middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it("should return 401 if user is not authenticated", () => {
    const middleware = roleCheck(["admin"]);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Authentication required. Use auth middleware before roleCheck.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if user role is not allowed", () => {
    req.user = { role: "viewer" };
    const middleware = roleCheck(["admin", "editor"]);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Access denied. Insufficient permissions.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() if user role is allowed", () => {
    req.user = { role: "admin" };
    const middleware = roleCheck(["admin", "editor"]);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
