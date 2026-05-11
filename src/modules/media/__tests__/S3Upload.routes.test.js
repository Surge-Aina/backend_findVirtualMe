jest.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: jest.fn().mockImplementation((opts) => ({ ...opts, name: "PutObjectCommand" })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://signed.example/upload"),
}));

jest.mock("uuid", () => ({ v4: () => "fixed-uuid" }));

jest.mock("../../../shared/middleware/auth", () => (req, res, next) => {
  req.user = { _id: "user123" };
  next();
});

jest.mock("../../portfolios/portfolio.service", () => ({
  assertPortfolioOwner: jest.fn(),
}));

jest.mock("../../../shared/services/s3Service", () => ({
  s3: {},
  deleteFromS3: jest.fn().mockResolvedValue(undefined),
  keyFromPublicUrl: jest.fn(),
}));

const request = require("supertest");
const express = require("express");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { assertPortfolioOwner } = require("../../portfolios/portfolio.service");
const { deleteFromS3, keyFromPublicUrl } = require("../../../shared/services/s3Service");
const s3UploadRoutes = require("../S3Upload.routes");

function appWithRouter() {
  const app = express();
  app.use(express.json());
  app.use("/", s3UploadRoutes);
  return app;
}

describe("S3Upload.routes", () => {
  const app = appWithRouter();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_S3_BUCKET = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    assertPortfolioOwner.mockResolvedValue({ ok: true });
    keyFromPublicUrl.mockImplementation((url) => {
      if (url.includes("portfolios/p1/")) return "portfolios/p1/key.jpg";
      return null;
    });
  });

  describe("POST /", () => {
    it("returns 400 when fileType missing", async () => {
      const res = await request(app).post("/").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/fileType/);
    });

    it("returns 400 for unsupported MIME", async () => {
      const res = await request(app)
        .post("/")
        .send({ fileType: "application/pdf" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when portfolio owner check fails", async () => {
      assertPortfolioOwner.mockResolvedValue({
        ok: false,
        status: 403,
        error: "nope",
      });

      const res = await request(app).post("/").send({
        fileType: "image/jpeg",
        portfolioId: "p1",
        contentLength: 100,
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("nope");
    });

    it("returns 400 when contentLength invalid for portfolio upload", async () => {
      const res = await request(app).post("/").send({
        fileType: "image/jpeg",
        portfolioId: "p1",
        contentLength: 0,
      });

      expect(res.status).toBe(400);
    });

    it("returns uploadUrl and publicUrl for portfolio path", async () => {
      const res = await request(app).post("/").send({
        fileType: "image/png",
        portfolioId: "p1",
        contentLength: 1024,
      });

      expect(res.status).toBe(200);
      expect(res.body.uploadUrl).toBe("https://signed.example/upload");
      expect(res.body.key).toContain("portfolios/p1/");
      expect(res.body.key).toContain("fixed-uuid");
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it("legacy hero path without portfolioId", async () => {
      const res = await request(app).post("/").send({
        fileType: "image/gif",
      });

      expect(res.status).toBe(200);
      expect(res.body.key).toMatch(/^hero-images\/fixed-uuid$/);
    });

    it("returns 500 when getSignedUrl throws", async () => {
      getSignedUrl.mockRejectedValueOnce(new Error("sign fail"));

      const res = await request(app).post("/").send({
        fileType: "image/jpeg",
      });

      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /", () => {
    it("returns 400 without imageUrl", async () => {
      const res = await request(app).delete("/").send({ portfolioId: "p1" });
      expect(res.status).toBe(400);
    });

    it("returns 400 without portfolioId", async () => {
      const res = await request(app).delete("/").send({ imageUrl: "http://x" });
      expect(res.status).toBe(400);
    });

    it("returns owner error from assertPortfolioOwner", async () => {
      assertPortfolioOwner.mockResolvedValue({
        ok: false,
        status: 403,
        error: "denied",
      });

      const res = await request(app).delete("/").send({
        imageUrl: "https://test-bucket.s3.us-east-1.amazonaws.com/portfolios/p1/x.jpg",
        portfolioId: "p1",
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 when key cannot be parsed", async () => {
      keyFromPublicUrl.mockReturnValueOnce(null);

      const res = await request(app).delete("/").send({
        imageUrl: "https://bad",
        portfolioId: "p1",
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 when key prefix mismatch", async () => {
      keyFromPublicUrl.mockReturnValueOnce("portfolios/other/x.jpg");

      const res = await request(app).delete("/").send({
        imageUrl: "https://x",
        portfolioId: "p1",
      });

      expect(res.status).toBe(403);
    });

    it("deletes and returns ok", async () => {
      keyFromPublicUrl.mockReturnValueOnce("portfolios/p1/file.jpg");

      const res = await request(app).delete("/").send({
        imageUrl: "https://test-bucket.s3.us-east-1.amazonaws.com/portfolios/p1/file.jpg",
        portfolioId: "p1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(deleteFromS3).toHaveBeenCalledWith("portfolios/p1/file.jpg");
    });

    it("returns 500 when deleteFromS3 throws", async () => {
      keyFromPublicUrl.mockReturnValueOnce("portfolios/p1/file.jpg");
      deleteFromS3.mockRejectedValueOnce(new Error("s3"));

      const res = await request(app).delete("/").send({
        imageUrl: "https://test-bucket.s3.us-east-1.amazonaws.com/portfolios/p1/file.jpg",
        portfolioId: "p1",
      });

      expect(res.status).toBe(500);
    });
  });
});
