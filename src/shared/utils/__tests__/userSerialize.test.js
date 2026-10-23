const { normalizeUserAppTheme } = require("../userSerialize");

describe("userSerialize", () => {
  it("returns undefined for falsy input", () => {
    expect(normalizeUserAppTheme(null)).toBeNull();
    expect(normalizeUserAppTheme(undefined)).toBeUndefined();
  });

  it("uses toObject when available", () => {
    const doc = {
      toObject: () => ({ appTheme: "dark", name: "a" }),
    };
    expect(normalizeUserAppTheme(doc)).toEqual({
      appTheme: "dark",
      name: "a",
    });
  });

  it("defaults appTheme to light when not dark", () => {
    expect(normalizeUserAppTheme({ appTheme: "invalid", x: 1 })).toEqual({
      appTheme: "light",
      x: 1,
    });
  });

  it("omits password and reset secrets", () => {
    expect(
      normalizeUserAppTheme({
        appTheme: "light",
        password: "hash",
        resetPasswordToken: "token",
        resetPasswordExpires: new Date(),
      })
    ).toEqual({ appTheme: "light" });
  });

  it("keeps dark theme", () => {
    expect(normalizeUserAppTheme({ appTheme: "dark" })).toEqual({
      appTheme: "dark",
    });
  });
});
