const { KNOWN_BLOCK_TYPES } = require("../../portfolios/models/blockTypes");
const extensions = require("../walletmeExtensions");

describe("WalletMe extension points", () => {
  it("reserves later slice names without registering the site block", () => {
    expect(extensions.PLANNED_WEBHOOK_EVENTS.LEAD_CAPTURED).toBe("lead.captured");
    expect(extensions.PLANNED_BLOCK_TYPES.ADD_TO_WALLET).toBe("addToWallet");
    expect(extensions.LEAD_CAPTURED_EVENT_FIELDS).toEqual([
      "id",
      "type",
      "createdAt",
      "data",
    ]);
    expect(extensions.WALLETME_CREDENTIAL_FIELDS).toEqual([
      "userId",
      "ciphertext",
      "iv",
      "authTag",
      "keyVersion",
    ]);
    expect(KNOWN_BLOCK_TYPES).not.toContain("addToWallet");
  });

  it("does not sign, emit, or store anything yet", () => {
    expect(() => extensions.createLeadCapturedEvent()).toThrow(
      /lead\.captured webhook is not available/
    );
    expect(() => extensions.signWebhookPayload()).toThrow(/not available/);
    expect(() => extensions.storeWalletMeCredential()).toThrow(
      /WalletMe credential storage is not available/
    );

    try {
      extensions.createLeadCapturedEvent();
    } catch (err) {
      expect(err.code).toBe("NOT_IMPLEMENTED");
      expect(err.status).toBe(501);
    }
  });
});
