const { buildBusinessProfile } = require("../businessProfile");

function portfolio(overrides) {
  return {
    _id: { toString: () => "site_synthetic" },
    title: "",
    themeTokens: {},
    pageBannerDefaults: {},
    sections: [],
    ...overrides,
  };
}

describe("buildBusinessProfile", () => {
  it("reads published business fields and drops private contact values", () => {
    const profile = buildBusinessProfile(
      portfolio({
        title: "Fallback Title",
        themeTokens: {
          accent: "#112233",
          accentStrong: "#abcdef",
          page: "#ffffff",
          text: "not-a-color",
          note: "do-not-leak-token",
        },
        pageBannerDefaults: {
          gradientFrom: "#010203",
          backgroundImage: "https://cdn.example.test/banner.png",
        },
        sections: [
          {
            type: "hero",
            visible: true,
            data: {
              practiceName: "Northwind Clinic",
              logoImage: "https://cdn.example.test/logo.png",
              phone: "(555) 010-2020",
            },
          },
          {
            type: "contact",
            visible: true,
            data: {
              email: "desk@example.test",
              phone: "+1-555-010-9999",
              address: {
                street: "100 Synthetic Ave",
                city: "Austin",
                state: "TX",
                zip: "78701-1234",
                country: "US",
              },
            },
          },
        ],
      })
    );

    expect(profile).toEqual({
      siteId: "site_synthetic",
      businessName: "Northwind Clinic",
      logoUrl: "https://cdn.example.test/logo.png",
      brandColors: {
        accent: "#112233",
        accentStrong: "#abcdef",
        page: "#ffffff",
        gradientFrom: "#010203",
      },
      address: {
        line1: "100 Synthetic Ave",
        city: "Austin",
        region: "TX",
        postalCode: "78701-1234",
        country: "US",
        formatted: "100 Synthetic Ave, Austin, TX, 78701-1234, US",
      },
    });

    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("desk@example.test");
    expect(serialized).not.toContain("555");
    expect(serialized).not.toContain("do-not-leak-token");
    expect(serialized).not.toContain("banner.png");
  });

  it("ignores hidden sections and rejects non-http logos", () => {
    const profile = buildBusinessProfile(
      portfolio({
        title: "",
        sections: [
          {
            type: "hero",
            visible: false,
            data: {
              practiceName: "Hidden Practice",
              logoImage: "https://cdn.example.test/hidden.png",
            },
          },
          {
            type: "contact",
            visible: false,
            data: {
              email: "hidden@example.test",
              phone: "+1-555-010-4242",
              address: { street: "9 Hidden Rd", city: "Austin", state: "TX", zip: "78702" },
            },
          },
          {
            type: "summary",
            visible: true,
            data: {
              name: "Northstar Studio",
              email: "person@example.test",
              phone: "555-0100",
              location: "Austin, TX",
              profileImage: "javascript:alert(1)",
              logoUrl: "https://cdn.example.test/studio.png",
            },
          },
        ],
      })
    );

    expect(profile.businessName).toBe("Northstar Studio");
    expect(profile.logoUrl).toBe("https://cdn.example.test/studio.png");
    expect(profile.address).toEqual({
      line1: null,
      city: null,
      region: null,
      postalCode: null,
      country: null,
      formatted: "Austin, TX",
    });

    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("hidden@example.test");
    expect(serialized).not.toContain("person@example.test");
    expect(serialized).not.toContain("555-0100");
    expect(serialized).not.toContain("9 Hidden Rd");
    expect(serialized).not.toContain("javascript:");
  });

  it("drops a location that is only an email or phone", () => {
    const profile = buildBusinessProfile(
      portfolio({
        sections: [
          {
            type: "summary",
            visible: true,
            data: { name: "Studio", location: "person@example.test" },
          },
        ],
      })
    );

    expect(profile.businessName).toBe("Studio");
    expect(profile.address).toBeNull();
    expect(profile.logoUrl).toBeNull();
    expect(JSON.stringify(profile)).not.toContain("person@example.test");
  });
});
