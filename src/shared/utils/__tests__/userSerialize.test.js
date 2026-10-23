const {
  normalizeUserAppTheme,
  serializeUser,
  serializePublicUser,
} = require("../userSerialize");

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

  it("strips stripe ids and keeps email for the account holder", () => {
    expect(
      serializeUser(
        {
          email: "a@example.com",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          googleId: "g_1",
          password: "hash",
          domains: [{ domain: "a.com", paymentIntentId: "pi_123" }],
        },
        { includeEmail: true }
      )
    ).toEqual({
      email: "a@example.com",
      appTheme: "light",
      domains: [{ domain: "a.com" }],
    });
  });

  it("omits another user's email unless explicitly included", () => {
    expect(
      serializeUser({ email: "other@example.com", username: "other" }).email
    ).toBeUndefined();
  });

  it("public projection returns only display fields", () => {
    expect(
      serializePublicUser({
        _id: "abc",
        username: "ada",
        name: "Ada",
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: "Ada L",
        email: "ada@example.com",
        password: "hash",
        stripeCustomerId: "cus_x",
        resetPasswordToken: "tok",
      })
    ).toEqual({
      id: "abc",
      _id: "abc",
      displayName: "Ada L",
      username: "ada",
      name: "Ada",
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });
});
