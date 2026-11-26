const {
  extractPlatformCustomerSlugFromHostname,
  extractPlatformCustomerSlugFromOrigin,
  isPlatformCustomerOrigin,
  RESERVED_PLATFORM_LABELS,
} = require("../platformSubdomain");

const ORIGINAL_PUBLIC_SITE_HOST = process.env.PUBLIC_SITE_HOST;

beforeEach(() => {
  process.env.PUBLIC_SITE_HOST = "findvirtual.me";
});

afterAll(() => {
  if (ORIGINAL_PUBLIC_SITE_HOST === undefined) {
    delete process.env.PUBLIC_SITE_HOST;
  } else {
    process.env.PUBLIC_SITE_HOST = ORIGINAL_PUBLIC_SITE_HOST;
  }
});

describe("platform customer hostname parsing", () => {
  it("accepts a single-label customer subdomain", () => {
    expect(extractPlatformCustomerSlugFromHostname("acme.findvirtual.me")).toBe(
      "acme",
    );
  });

  it("rejects multi-level labels under the platform base", () => {
    expect(
      extractPlatformCustomerSlugFromHostname("a.b.findvirtual.me"),
    ).toBeNull();
  });

  it("rejects look-alike base domains without a customer label", () => {
    expect(extractPlatformCustomerSlugFromHostname("evilfindvirtual.me")).toBeNull();
  });

  it("rejects unrelated suffix hosts", () => {
    expect(extractPlatformCustomerSlugFromHostname("findvirtual.me.evil.com")).toBeNull();
  });

  it("rejects hostnames with explicit ports", () => {
    expect(
      extractPlatformCustomerSlugFromHostname("acme.findvirtual.me:443"),
    ).toBeNull();
  });
});

describe("platform customer origin parsing (CORS)", () => {
  const allow = [
    "https://acme.findvirtual.me",
    "https://a9.findvirtual.me",
  ];

  test.each(allow)('allows %s', (origin) => {
    expect(isPlatformCustomerOrigin(origin)).toBe(true);
    expect(extractPlatformCustomerSlugFromOrigin(origin)).toBeTruthy();
  });

  const deny = [
    "http://acme.findvirtual.me",
    "https://acme.findvirtual.me:8443",
    "https://evilfindvirtual.me",
    "https://findvirtual.me.evil.com",
    "https://acme.evil.findvirtual.me",
    "https://acme.findvirtual.me/path",
    "not-a-url",
  ];

  test.each(deny)('denies %s', (origin) => {
    expect(isPlatformCustomerOrigin(origin)).toBe(false);
  });
});

describe("reserved platform labels", () => {
  it("includes infrastructure labels", () => {
    expect(RESERVED_PLATFORM_LABELS.has("www")).toBe(true);
    expect(RESERVED_PLATFORM_LABELS.has("api")).toBe(true);
    expect(RESERVED_PLATFORM_LABELS.has("autodiscover")).toBe(true);
  });
});