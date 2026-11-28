const {
  pickSummaryFields,
  sanitizeSectionDataAllowlist,
  assertAllowedUrl,
} = require("../sectionDataAllowlist");

describe("sectionDataAllowlist", () => {
  it("drops unknown summary fields and strips proto keys", () => {
    const out = pickSummaryFields({
      name: "Alex",
      extra: "nope",
      __proto__: { polluted: true },
    });
    expect(out).toEqual({ name: "Alex" });
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it("rejects javascript URLs in resumeUrl", () => {
    expect(() => assertAllowedUrl("javascript:alert(1)", "resumeUrl")).toThrow(/Invalid URL/);
  });

  it("allows https resume links", () => {
    expect(assertAllowedUrl("https://example.com/cv.pdf", "resumeUrl")).toBe(
      "https://example.com/cv.pdf"
    );
  });

  it("rejects forbidden top-level keys in section sanitize", () => {
    expect(() =>
      sanitizeSectionDataAllowlist("summary", { name: "A", constructor: { x: 1 } })
    ).toThrow(/Disallowed key/);
  });
});