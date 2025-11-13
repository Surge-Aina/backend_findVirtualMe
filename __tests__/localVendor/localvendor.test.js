require("../../../../setup"); // Make sure this is first
const request = require("supertest");
const app = require("../../../../testapp");
const LocalVendorPortfolio = require("../../../../models/localFoodVendor/LocalVendorPortfolio");
const openAiService = require("../../../../services/openAiService");

jest.mock("../../../../services/openAiService");

// Optional: catch any unexpected errors and log for debugging
app.use((err, req, res, next) => {
  console.error("Express error:", err);
  res.status(500).json({ error: err.message });
});

describe("Local Vendor Portfolio API", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalVendorPortfolio.deleteMany({});
  });

  it("should create a vendor portfolio from a valid PDF upload", async () => {
    openAiService.generateVendorAboutAndMenuJSON.mockResolvedValue({
      vendor: { name: "Test Vendor", email: "test@example.com", phone: "1234567890" },
      about: {
        banner: { title: "About Us" },
        contentBlocks: [],
        gridImages: [],
      },
      menuItems: [{ name: "Burger", price: 5.99 }],
    });

    const res = await request(app)
      .post("/vendor/inject")
      .attach("file", Buffer.from("ignored-by-mock"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      })
      .expect(201);

    expect(res.body.vendor.name).toBe("Test Vendor");
    expect(res.body.menuItems[0].name).toBe("Burger");
  });

  it("should reject when vendor JSON is missing required fields", async () => {
    openAiService.generateVendorAboutAndMenuJSON.mockResolvedValue({
      vendor: { name: "", email: "bad@test.com", phone: "" }, // missing name & phone
      about: { banner: { title: "Bad" }, contentBlocks: [], gridImages: [] },
      menuItems: [],
    });

    const res = await request(app)
      .post("/vendor/inject")
      .attach("file", Buffer.from("ignored-by-mock"), {
        filename: "bad.pdf",
        contentType: "application/pdf",
      })
      .expect(400);

    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it("should reject duplicate vendor creation by email", async () => {
    // Create existing vendor first
    await LocalVendorPortfolio.create({
      name: "Existing Vendor",
      email: "duplicate@test.com",
      phone: "",
    });

    openAiService.generateVendorAboutAndMenuJSON.mockResolvedValue({
      vendor: { name: "New Vendor", email: "duplicate@test.com", phone: "1234567890" },
      about: { banner: { title: "Dup" }, contentBlocks: [], gridImages: [] },
      menuItems: [],
    });

    const res = await request(app)
      .post("/vendor/inject")
      .attach("file", Buffer.from("ignored-by-mock"), {
        filename: "dup.pdf",
        contentType: "application/pdf",
      })
      .expect(400);

    expect(res.body.error).toMatch(/already exists/i);
  });

  it("should reject when no file is uploaded", async () => {
    const res = await request(app)
      .post("/vendor/inject")
      .set("x-test-no-file", "true")
      .expect(400);

    expect(res.body.error).toMatch(/file is required/i);
  });
});
