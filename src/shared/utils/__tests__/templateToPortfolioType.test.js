const {
  templateToPortfolioType,
  portfolioTypeToTemplate,
} = require("../templateToPortfolioType");

describe("templateToPortfolioType", () => {
  it("maps camelCase templates to snake_case portfolio types", () => {
    expect(templateToPortfolioType("projectManager")).toBe("project_manager");
    expect(templateToPortfolioType("dataScientist")).toBe("data_scientist");
    expect(templateToPortfolioType("cleaningServices")).toBe("cleaning_services");
    expect(templateToPortfolioType("localVendor")).toBe("local_vendor");
  });

  it("passes through identity mappings", () => {
    expect(templateToPortfolioType("healthcare")).toBe("healthcare");
    expect(templateToPortfolioType("handyman")).toBe("handyman");
    expect(templateToPortfolioType("photographer")).toBe("photographer");
  });

  it("returns null for falsy input", () => {
    expect(templateToPortfolioType(null)).toBeNull();
    expect(templateToPortfolioType(undefined)).toBeNull();
    expect(templateToPortfolioType("")).toBeNull();
  });

  it("returns the input unchanged for unknown templates", () => {
    expect(templateToPortfolioType("unknownTemplate")).toBe("unknownTemplate");
  });
});

describe("portfolioTypeToTemplate", () => {
  it("inverts the mapping", () => {
    expect(portfolioTypeToTemplate("project_manager")).toBe("projectManager");
    expect(portfolioTypeToTemplate("data_scientist")).toBe("dataScientist");
    expect(portfolioTypeToTemplate("healthcare")).toBe("healthcare");
  });

  it("returns null for falsy input", () => {
    expect(portfolioTypeToTemplate(null)).toBeNull();
  });
});
