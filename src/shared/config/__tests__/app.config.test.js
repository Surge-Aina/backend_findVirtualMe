describe("app.config", () => {
  const keys = [
    "ADMIN_EMAIL",
    "ADMIN_USERNAME",
    "CUSTOMER_EMAIL",
    "CUSTOMER_USERNAME",
    "MONGODB_URI",
    "MONGODB_URI_TEST",
  ];
  const original = {};

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it("does not invent user emails or a local Mongo URI when env is missing", () => {
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }

    jest.resetModules();
    const config = require("../app.config");

    expect(config.defaultUsers.admin.email).toBeUndefined();
    expect(config.defaultUsers.customer.email).toBeUndefined();
    expect(config.database.uri).toBeUndefined();
    expect(config.database.testUri).toBeUndefined();

    const serialized = JSON.stringify(config);
    expect(serialized).not.toContain("admin@test.com");
    expect(serialized).not.toContain("cust@test.com");
    expect(serialized).not.toContain("mongodb://");
  });
});