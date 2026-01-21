require("../../setup");

// Silence logs
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

jest.mock("pdf-parse", () => jest.fn());
jest.mock("mammoth", () => ({
  extractRawText: jest.fn(),
}));

jest.mock("pdf-lib", () => ({
  PDFDocument: { load: jest.fn() },
}));

jest.mock("pdfjs-dist/legacy/build/pdf.js", () => ({
  getDocument: jest.fn(),
}));

// Mock DB models
jest.mock("../../models/localFoodVendor/LocalVendorPortfolio", () => ({
  create: jest.fn(async (d) => ({ _id: "1", ...d })),
  findOne: jest.fn(async () => null),
}));

jest.mock("../../models/localFoodVendor/About", () => ({
  create: jest.fn(),
}));

jest.mock("../../models/localFoodVendor/Banner", () => ({
  create: jest.fn(),
}));

jest.mock("../../models/localFoodVendor/MenuItems", () => ({
  insertMany: jest.fn(),
}));

jest.mock("../../models/User", () => ({
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../services/openAiService", () => ({
  generateVendorAboutAndMenuJSON: jest.fn(async () => ({
    vendor: {
      name: "FallbackVendor",
      email: "f@test.com",
      phone: "9999",
    },
    about: {},
    menuItems: [],
  })),
}));

describe("PDF extraction fallback branches", () => {
  let injectVendorPortfolio;
  let pdfParse;
  let pdfjs;
  let mammoth;
  let pdfLib;

  let req;
  let res;

  beforeEach(() => {
    jest.resetModules();

    pdfParse = require("pdf-parse");
    pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
    mammoth = require("mammoth");
    pdfLib = require("pdf-lib");

    injectVendorPortfolio =
      require("../../controllers/localFoodVendor/localVendorController").injectVendorPortfolio;

    req = {
      file: null,
      body: {},
      user: { _id: "mockUserId" },
    };

    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
    };
  });

  it("should use pdfjs fallback when pdf-parse fails", async () => {
    pdfParse.mockRejectedValue(new Error("parse fail"));

    pdfjs.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn(() =>
          Promise.resolve({
            getTextContent: jest.fn(() =>
              Promise.resolve({ items: [{ str: "From PDFJS" }] })
            ),
          })
        ),
      }),
    });

    req.file = {
      buffer: Buffer.from("fake"),
      mimetype: "application/pdf",
    };

    await injectVendorPortfolio(req, res);

    expect(pdfjs.getDocument).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should use pdf-lib metadata fallback when pdfjs fails", async () => {
    pdfParse.mockRejectedValue(new Error("parse fail"));

    pdfjs.getDocument.mockReturnValue({
      promise: Promise.reject(new Error("pdfjs fail")),
    });

    pdfLib.PDFDocument.load.mockResolvedValue({
      getTitle: () => "MetaFallback",
    });

    req.file = {
      buffer: Buffer.from("fake"),
      mimetype: "application/pdf",
    };

    await injectVendorPortfolio(req, res);

    expect(pdfLib.PDFDocument.load).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should use docx fallback for non PDF files", async () => {
    mammoth.extractRawText.mockResolvedValue({ value: "DOCX TEXT" });

    req.file = {
      buffer: Buffer.from("file"),
      mimetype:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    await injectVendorPortfolio(req, res);

    expect(mammoth.extractRawText).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should continue even if ALL PDF fallbacks fail", async () => {
    pdfParse.mockRejectedValue(new Error("parse fail"));

    pdfjs.getDocument.mockReturnValue({
      promise: Promise.reject(new Error("pdfjs fail")),
    });

    pdfLib.PDFDocument.load.mockRejectedValue(new Error("meta fail"));

    req.file = {
      buffer: Buffer.from("fake"),
      mimetype: "application/pdf",
    };

    await injectVendorPortfolio(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});
