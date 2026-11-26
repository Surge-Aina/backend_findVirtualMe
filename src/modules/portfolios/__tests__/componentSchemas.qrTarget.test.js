const {
  ComponentConfigError,
  validateComponentProps,
  normalizeQrCodeTarget,
} = require("../models/componentSchemas");

const Qr_BASE = { title: "QR", size: 160, caption: "" };

describe("QrCode target validation", () => {
  function expectReject(target) {
    expect(() => validateComponentProps("QrCode", { ...Qr_BASE, target })).toThrow(ComponentConfigError);
    expect(() => normalizeQrCodeTarget(target)).toThrow(ComponentConfigError);
  }

  function expectAccept(target) {
    const section = validateComponentProps("QrCode", { ...Qr_BASE, target });
    expect(section.target).toBe(target.trim());
    expect(normalizeQrCodeTarget(target)).toBe(target.trim());
  }

  it("rejects protocol-relative and traversal paths", () => {
    expectReject("//evil.com");
    expectReject("///evil.com");
    expectReject("/a/../b");
  });

  it("rejects unsafe URL schemes and bare https", () => {
    expectReject("https://");
    expectReject("javascript:alert(1)");
    expectReject("data:text/html,hello");
  });

  it("accepts same-site paths with optional query", () => {
    expectAccept("/contact");
    expectAccept("/contact?ref=qr");
  });

  it("accepts https URLs with a host", () => {
    expectAccept("https://example.test/menu");
  });
});

describe("VoucherOffer ctaUrl validation", () => {
  const VOUCHER_ID = "507f1f77bcf86cd799439099";

  it("rejects javascript and https without host", () => {
    expect(() =>
      validateComponentProps("VoucherOffer", {
        title: "Offer",
        voucherId: VOUCHER_ID,
        description: "",
        cta: "Go",
        ctaUrl: "javascript:alert(1)",
      })
    ).toThrow(ComponentConfigError);

    expect(() =>
      validateComponentProps("VoucherOffer", {
        title: "Offer",
        voucherId: VOUCHER_ID,
        description: "",
        cta: "Go",
        ctaUrl: "https://",
      })
    ).toThrow(ComponentConfigError);
  });

  it("trims valid ctaUrl", () => {
    const section = validateComponentProps("VoucherOffer", {
      title: "Offer",
      voucherId: VOUCHER_ID,
      description: "",
      cta: "Go",
      ctaUrl: "  https://example.test/offer  ",
    });
    expect(section.ctaUrl).toBe("https://example.test/offer");
  });
});