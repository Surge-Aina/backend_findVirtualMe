require("../../setup");
jest.unmock("multer");

// Silence noisy logs from controller during tests
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

// Mock LocalVendorPortfolio with in-memory store
jest.mock("../../models/localFoodVendor/LocalVendorPortfolio", () => {
  const dataStore = [];

  function MockLocalVendorPortfolio(data) {
    Object.assign(this, data);
    this._id = this._id || `${dataStore.length + 1}`;
  }

  MockLocalVendorPortfolio.prototype.save = jest.fn(async function () {
    const existing = dataStore.find((v) => v._id === this._id);
    if (!existing) dataStore.push(this);
    return this;
  });

  MockLocalVendorPortfolio.create = jest.fn(async (vendor) => {
    const existing = dataStore.find((v) => v.email === vendor.email);
    if (existing) throw new Error("duplicate key error");
    const newVendor = new MockLocalVendorPortfolio(vendor);
    dataStore.push(newVendor);
    return newVendor;
  });

  MockLocalVendorPortfolio.find = jest.fn(async () => dataStore.slice());

  MockLocalVendorPortfolio.findById = jest.fn(async (id) => {
    return dataStore.find((v) => v._id === id) || null;
  });

  MockLocalVendorPortfolio.findByIdAndUpdate = jest.fn(async (id, update) => {
    const vendor = dataStore.find((v) => v._id === id);
    if (!vendor) return null;
    Object.assign(vendor, update);
    return vendor;
  });

  MockLocalVendorPortfolio.findByIdAndDelete = jest.fn(async (id) => {
    const index = dataStore.findIndex((v) => v._id === id);
    if (index === -1) return null;
    const [deleted] = dataStore.splice(index, 1);
    return deleted;
  });

  MockLocalVendorPortfolio.findOne = jest.fn(async (query) => {
    if (query.email) {
      return dataStore.find((v) => v.email === query.email) || null;
    }
    return null;
  });

  MockLocalVendorPortfolio.deleteMany = jest.fn(async () => {
    dataStore.length = 0;
    return { acknowledged: true };
  });

  // exposed only for debugging if ever needed
  MockLocalVendorPortfolio.__dataStore = dataStore;

  return MockLocalVendorPortfolio;
});

// Dependent models
jest.mock("../../models/localFoodVendor/About", () => ({
  create: jest.fn(async (data) => ({ _id: "mockAboutId", ...data })),
  findOne: jest.fn(async () => null),
}));

jest.mock("../../models/localFoodVendor/Banner", () => ({
  create: jest.fn(async (data) => ({ _id: "mockBannerId", ...data })),
  find: jest.fn(async () => [{ _id: "banner1" }]),
}));

jest.mock("../../models/localFoodVendor/MenuItems", () => ({
  insertMany: jest.fn(async (data) =>
    data.map((d, i) => ({ _id: `menu${i}`, ...d }))
  ),
  find: jest.fn(async () => [{ _id: "menu1" }]),
}));

jest.mock("../../models/localFoodVendor/GalleryImage", () => ({
  find: jest.fn(async () => [{ _id: "gallery1" }]),
}));

jest.mock("../../models/localFoodVendor/Review", () => ({
  find: jest.fn(async () => [{ _id: "review1" }]),
}));

jest.mock("../../models/localFoodVendor/TaggedImage", () => ({
  find: jest.fn(() => ({
    populate: jest
      .fn()
      .mockResolvedValue([{ _id: "tag1", vendorId: "1", tags: [] }]),
  })),
}));

// User and seedVendor
jest.mock("../../models/User", () => ({
  findByIdAndUpdate: jest.fn(async () => ({})),
}));

jest.mock("../../models/localFoodVendor/seedVendor", () =>
  jest.fn(async () => true)
);

// OpenAI service
jest.mock("../../services/openAiService", () => ({
  generateVendorAboutAndMenuJSON: jest.fn(),
}));

// File parsing stack
jest.mock("pdf-parse", () =>
  jest.fn(async () => ({
    text: "Simulated parsed PDF text with enough content to pass validation.".repeat(
      2
    ),
  }))
);

jest.mock("mammoth", () => ({
  extractRawText: jest.fn(async () => ({ value: "Fake DOCX text" })),
}));

jest.mock("pdf-lib", () => ({
  PDFDocument: { load: jest.fn(async () => ({ getTitle: () => "Mock" })) },
}));

jest.mock("pdfjs-dist/legacy/build/pdf.js", () => ({
  getDocument: jest.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: jest.fn(() =>
        Promise.resolve({
          getTextContent: jest.fn(() =>
            Promise.resolve({ items: [{ str: "PDFJS extracted text" }] })
          ),
        })
      ),
    }),
  })),
}));

// Auth middleware
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.user = { _id: "mockUserId" };
  next();
});

// Imports
const express = require("express");
const request = require("supertest");
const LocalVendorPortfolio = require("../../models/localFoodVendor/LocalVendorPortfolio");
const About = require("../../models/localFoodVendor/About");
const Banner = require("../../models/localFoodVendor/Banner");
const MenuItem = require("../../models/localFoodVendor/MenuItems");
const GalleryImage = require("../../models/localFoodVendor/GalleryImage");
const Review = require("../../models/localFoodVendor/Review");
const TaggedImage = require("../../models/localFoodVendor/TaggedImage");
const User = require("../../models/User");
const seedVendor = require("../../models/localFoodVendor/seedVendor");
const {
  generateVendorAboutAndMenuJSON,
} = require("../../services/openAiService");
const vendorRoutes = require("../../routes/localFoodVendor/localVendorRoutes");

// Express app
const app = express();
app.use(express.json());
app.use("/vendor", vendorRoutes);

describe("Local Vendor Portfolio API", () => {
  const basePath = "/vendor";

  afterEach(async () => {
    await LocalVendorPortfolio.deleteMany();
  });

  describe("POST /vendor (createVendor)", () => {
    it("should create a vendor, seed it and link to user", async () => {
      const res = await request(app)
        .post(basePath)
        .send({ name: "Vendor One", email: "one@test.com", phone: "12345" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Vendor One");

      expect(seedVendor).toHaveBeenCalledTimes(1);
      expect(seedVendor).toHaveBeenCalledWith(expect.any(String));

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("mockUserId", {
        $addToSet: { portfolios: expect.any(String) },
      });
    });

    it("should return 400 if vendor save fails", async () => {
      const saveSpy = jest
        .spyOn(LocalVendorPortfolio.prototype, "save")
        .mockRejectedValue(new Error("fail"));

      const res = await request(app)
        .post(basePath)
        .send({ name: "Bad", email: "bad@test.com", phone: "999" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Failed to create vendor");
      saveSpy.mockRestore();
    });
  });

  describe("GET /vendor (getAllVendors)", () => {
    it("should fetch all vendors", async () => {
      await LocalVendorPortfolio.create({
        name: "V1",
        email: "v1@test.com",
        phone: "111",
      });
      await LocalVendorPortfolio.create({
        name: "V2",
        email: "v2@test.com",
        phone: "222",
      });

      const res = await request(app).get(basePath);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it("should return 500 if fetch fails", async () => {
      const spy = jest
        .spyOn(LocalVendorPortfolio, "find")
        .mockRejectedValue(new Error("fail"));

      const res = await request(app).get(basePath);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch vendors");
      spy.mockRestore();
    });
  });

  describe("GET /vendor/:vendorId (getVendorById)", () => {
    it("should fetch a vendor by id", async () => {
      const created = await LocalVendorPortfolio.create({
        name: "FetchMe",
        email: "fetch@test.com",
        phone: "123",
      });

      const res = await request(app).get(`${basePath}/${created._id}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("FetchMe");
    });

    it("should return 404 if vendor not found", async () => {
      const res = await request(app).get(`${basePath}/999`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Vendor not found");
    });

    it("should return 500 if fetching vendor fails", async () => {
      const spy = jest
        .spyOn(LocalVendorPortfolio, "findById")
        .mockRejectedValue(new Error("fail"));

      const res = await request(app).get(`${basePath}/123`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch vendor");
      spy.mockRestore();
    });
  });

  describe("PUT /vendor/:vendorId (updateVendor)", () => {
    it("should update vendor details successfully", async () => {
      const created = await LocalVendorPortfolio.create({
        name: "Old Vendor",
        email: "old@test.com",
        phone: "1234567890",
      });

      const res = await request(app)
        .put(`${basePath}/${created._id}`)
        .send({ name: "Updated Vendor" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Vendor");
    });

    it("should return 404 for updating non existing vendor", async () => {
      const res = await request(app)
        .put(`${basePath}/999`)
        .send({ name: "DoesNotExist" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Vendor not found");
    });

    it("should return 500 when update fails", async () => {
      const spy = jest
        .spyOn(LocalVendorPortfolio, "findByIdAndUpdate")
        .mockRejectedValue(new Error("fail"));

      const res = await request(app)
        .put(`${basePath}/123`)
        .send({ name: "Fail" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update vendor");
      spy.mockRestore();
    });
  });

  describe("DELETE /vendor/:vendorId (deleteVendor)", () => {
    it("should delete vendor successfully", async () => {
      const created = await LocalVendorPortfolio.create({
        name: "ToDelete",
        email: "del@test.com",
        phone: "12345",
      });

      const res = await request(app).delete(`${basePath}/${created._id}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Vendor deleted");
      // Route does not use auth for delete, so user unlink will not run
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("should return 404 when deleting non existing vendor", async () => {
      const res = await request(app).delete(`${basePath}/999`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Vendor not found");
    });

    it("should return 500 when delete fails", async () => {
      const spy = jest
        .spyOn(LocalVendorPortfolio, "findByIdAndDelete")
        .mockRejectedValue(new Error("fail"));

      const res = await request(app).delete(`${basePath}/123`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to delete vendor");
      spy.mockRestore();
    });
  });

  describe("GET /vendor/:vendorId/full (getFullPortfolio)", () => {
    it("should return 404 if vendor not found", async () => {
      const res = await request(app).get(`${basePath}/999/full`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Vendor not found");
    });

    it("should return 500 if fetching full portfolio fails", async () => {
      const spy = jest
        .spyOn(LocalVendorPortfolio, "findById")
        .mockRejectedValue(new Error("fail"));

      const res = await request(app).get(`${basePath}/123/full`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch full portfolio");
      spy.mockRestore();
    });
  });

  describe("POST /vendor/inject (injectVendorPortfolio)", () => {
    it("should create a vendor portfolio from a valid PDF upload", async () => {
      generateVendorAboutAndMenuJSON.mockResolvedValue({
        vendor: {
          name: "Test Vendor",
          email: "test@example.com",
          phone: "12345",
        },
        about: {
          banner: { title: "About" },
          contentBlocks: [],
          gridImages: [],
        },
        menuItems: [{ name: "Burger", price: 5.99 }],
      });

      const res = await request(app)
        .post(`${basePath}/inject`)
        .attach("file", Buffer.from("mock-data"), {
          filename: "test.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(201);
      expect(res.body.vendor.name).toBe("Test Vendor");

      expect(LocalVendorPortfolio.create).toHaveBeenCalledTimes(1);
      expect(About.create).toHaveBeenCalledTimes(1);
      expect(Banner.create).toHaveBeenCalledTimes(1);
      expect(MenuItem.insertMany).toHaveBeenCalledTimes(1);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("mockUserId", {
        $addToSet: { portfolios: expect.any(String) },
      });
    });

    it("should reject when vendor JSON is missing required fields", async () => {
      generateVendorAboutAndMenuJSON.mockResolvedValue({
        vendor: { name: "", email: "bad@test.com", phone: "" },
        about: { banner: { title: "Bad" } },
        menuItems: [],
      });

      const res = await request(app)
        .post(`${basePath}/inject`)
        .attach("file", Buffer.from("mock"), {
          filename: "bad.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing required fields/i);
    });

    it("should reject duplicate vendor creation by email", async () => {
      await LocalVendorPortfolio.create({
        name: "Existing",
        email: "dup@test.com",
        phone: "1111",
      });

      generateVendorAboutAndMenuJSON.mockResolvedValue({
        vendor: { name: "New", email: "dup@test.com", phone: "1234" },
        about: { banner: { title: "Dup" } },
        menuItems: [],
      });

      const res = await request(app)
        .post(`${basePath}/inject`)
        .attach("file", Buffer.from("mock"), {
          filename: "dup.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it("should return 400 if OpenAI JSON generation fails", async () => {
      generateVendorAboutAndMenuJSON.mockRejectedValue(new Error("Bad JSON"));

      const res = await request(app)
        .post(`${basePath}/inject`)
        .attach("file", Buffer.from("mock"), {
          filename: "bad-ai.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/could not convert the document/i);
    });

    it("should return 500 if inject flow crashes unexpectedly", async () => {
      generateVendorAboutAndMenuJSON.mockResolvedValue({
        vendor: {
          name: "CrashVendor",
          email: "crash@test.com",
          phone: "1234",
        },
        about: { banner: { title: "About" } },
        menuItems: [{ name: "Item", price: 1 }],
      });

      const spy = jest
        .spyOn(LocalVendorPortfolio, "create")
        .mockRejectedValue(new Error("DB fail"));

      const res = await request(app)
        .post(`${basePath}/inject`)
        .attach("file", Buffer.from("mock"), {
          filename: "crash.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe(
        "Failed to create vendor portfolio from document"
      );

      spy.mockRestore();
    });
  });
});
