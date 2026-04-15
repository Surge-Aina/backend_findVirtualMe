jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({ sub: "g1", email: "a@b.com", email_verified: true }),
    }),
  })),
}));

const { verifyGoogleToken } = require("../googleLogin.service");

describe("googleLogin.service", () => {
  it("verifyGoogleToken returns payload", async () => {
    process.env.GOOGLE_CLIENT_ID = "cid";
    const p = await verifyGoogleToken("token");
    expect(p.email).toBe("a@b.com");
  });
});
