const request = require("supertest");
const app = require("../../../../testapp");
const LocalVendorPortfolio = require("../../../../models/localFoodVendor/LocalVendorPortfolio");
const openAiService = require("../../../../services/openAiService");

jest.mock("../../../../services/openAiService");

describe("Local Vendor Portfolio API", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalVendorPortfolio.deleteMany({});
  });

  it("should create a vendor portfolio from a valid PDF upload", async () => {
    openAiService.generateVendorAboutAndMenuJSON.mockResolvedValue({
      vendor: { name: "Test Vendor", email: "test@example.com" },
      about: {
        banner: { title: "About Us" },
        contentBlocks: [],
        gridImages: [],
      },
      menuItems: [{ name: "Burger", price: 5.99 }],
    });

    const res = await request(app)
      .post("/vendor/inject")
      .attach("file", Buffer.from("dummy pdf text"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      })
      .expect(201);

    expect(res.body.vendor.name).toBe("Test Vendor");
    expect(res.body.menuItems[0].name).toBe("Burger");
  });

  it("should reject when vendor JSON is missing required fields", async () => {
    openAiService.generateVendorAboutAndMenuJSON.mockResolvedValue({
      vendor: { email: "bad@test.com" }, // missing name
      about: { banner: { title: "Bad" }, contentBlocks: [], gridImages: [] },
      menuItems: [],
    });

    const res = await request(app)
      .post("/vendor/inject")
      .attach("file", Buffer.from("dummy pdf text"), {
        filename: "bad.pdf",
        contentType: "application/pdf",
      })
      .expect(400);

    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it("should reject duplicate vendor creation by email", async () => {
    await LocalVendorPortfolio.create({
      name: "Existing Vendor",
      email: "duplicate@test.com",
    });

    openAiService.generateVendorAboutAndMenuJSON.mockResolvedValue({
      vendor: { name: "New Vendor", email: "duplicate@test.com" },
      about: { banner: { title: "Dup" }, contentBlocks: [], gridImages: [] },
      menuItems: [],
    });

    const res = await request(app)
      .post("/vendor/inject")
      .attach("file", Buffer.from("dummy pdf text"), {
        filename: "dup.pdf",
        contentType: "application/pdf",
      })
      .expect(400);

    expect(res.body.error).toMatch(/already exists/i);
  });
});
