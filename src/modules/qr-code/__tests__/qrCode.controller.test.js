jest.mock("../qrCode.service", () => ({
  getOnePublicQrCode: jest.fn(),
  getPublicQrCodes: jest.fn(),
  getPublicQrCodesByPortfolio: jest.fn(),
  getOneQrCode: jest.fn(),
  createQrCode: jest.fn(),
  updateQrCode: jest.fn(),
  deleteQrCode: jest.fn(),
  toggleActiveQrCode: jest.fn(),
  getQrCodesbyPortfolio: jest.fn(),
}));

const service = require("../qrCode.service");
const controller = require("../qrCode.controller");

describe("qrCode.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("getOnePublicQrCode", () => {
    it("returns 404 when not found", async () => {
      mockReq = { params: { id: "x" } };
      service.getOnePublicQrCode.mockResolvedValue(null);

      await controller.getOnePublicQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("returns qr on success", async () => {
      mockReq = { params: { id: "x" } };
      const doc = { _id: "x" };
      service.getOnePublicQrCode.mockResolvedValue(doc);

      await controller.getOnePublicQrCode(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(doc);
    });

    it("returns 500 on error", async () => {
      mockReq = { params: { id: "x" } };
      service.getOnePublicQrCode.mockRejectedValue(new Error("fail"));

      await controller.getOnePublicQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getPublicQrCodes", () => {
    it("calls service with ownerId from query", async () => {
      mockReq = { query: { ownerId: "o1" } };
      service.getPublicQrCodes.mockResolvedValue([]);

      await controller.getPublicQrCodes(mockReq, mockRes);

      expect(service.getPublicQrCodes).toHaveBeenCalledWith("o1");
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it("works without ownerId", async () => {
      mockReq = { query: {} };
      service.getPublicQrCodes.mockResolvedValue([]);

      await controller.getPublicQrCodes(mockReq, mockRes);

      expect(service.getPublicQrCodes).toHaveBeenCalledWith(undefined);
    });

    it("returns 500 on error", async () => {
      mockReq = { query: {} };
      service.getPublicQrCodes.mockRejectedValue(new Error("db"));

      await controller.getPublicQrCodes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getPublicQrCodesByPortfolio", () => {
    it("returns 500 on error", async () => {
      mockReq = { query: { portfolioId: "p", type: "t" } };
      service.getPublicQrCodesByPortfolio.mockRejectedValue(new Error("db"));

      await controller.getPublicQrCodesByPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("returns 400 when params missing", async () => {
      mockReq = { query: {} };

      await controller.getPublicQrCodesByPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when service returns falsy", async () => {
      mockReq = { query: { portfolioId: "p", type: "t" } };
      service.getPublicQrCodesByPortfolio.mockResolvedValue(null);

      await controller.getPublicQrCodesByPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("returns qr when found", async () => {
      mockReq = { query: { portfolioId: "p", type: "t" } };
      const doc = [{ _id: "q" }];
      service.getPublicQrCodesByPortfolio.mockResolvedValue(doc);

      await controller.getPublicQrCodesByPortfolio(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(doc);
    });
  });

  describe("getOneQrCode", () => {
    it("returns 500 on error", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      service.getOneQrCode.mockRejectedValue(new Error("db"));

      await controller.getOneQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("returns 404 when not found", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      service.getOneQrCode.mockResolvedValue(null);

      await controller.getOneQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("returns qr", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      const doc = { _id: "x" };
      service.getOneQrCode.mockResolvedValue(doc);

      await controller.getOneQrCode(mockReq, mockRes);

      expect(service.getOneQrCode).toHaveBeenCalledWith("x", "u1");
      expect(mockRes.json).toHaveBeenCalledWith(doc);
    });
  });

  describe("createQrCode", () => {
    it("returns 201", async () => {
      mockReq = { body: { title: "t" }, user: { id: "u1" } };
      const created = { _id: "n" };
      service.createQrCode.mockResolvedValue(created);

      await controller.createQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(created);
    });

    it("returns 400 on error", async () => {
      mockReq = { body: {}, user: { id: "u1" } };
      service.createQrCode.mockRejectedValue(new Error("bad"));

      await controller.createQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateQrCode", () => {
    it("returns 404 when not found", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" }, body: {} };
      service.updateQrCode.mockResolvedValue(null);

      await controller.updateQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("returns updated", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" }, body: { title: "n" } };
      const doc = { _id: "x" };
      service.updateQrCode.mockResolvedValue(doc);

      await controller.updateQrCode(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(doc);
    });

    it("returns 400 on error", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" }, body: {} };
      service.updateQrCode.mockRejectedValue(new Error("bad"));

      await controller.updateQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("deleteQrCode", () => {
    it("returns 404 when not found", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      service.deleteQrCode.mockResolvedValue(null);

      await controller.deleteQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("returns message on success", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      service.deleteQrCode.mockResolvedValue({ _id: "x" });

      await controller.deleteQrCode(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ message: "QR code deleted" });
    });

    it("returns 500 on error", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      service.deleteQrCode.mockRejectedValue(new Error("db"));

      await controller.deleteQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("toggleActiveQrCode", () => {
    it("returns 500 on error", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      service.toggleActiveQrCode.mockRejectedValue(new Error("db"));

      await controller.toggleActiveQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("returns 404 when not found", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      service.toggleActiveQrCode.mockResolvedValue(null);

      await controller.toggleActiveQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("returns qr", async () => {
      mockReq = { params: { id: "x" }, user: { id: "u1" } };
      const doc = { active: false };
      service.toggleActiveQrCode.mockResolvedValue(doc);

      await controller.toggleActiveQrCode(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(doc);
    });
  });

  describe("getQrCodesByPortfolio", () => {
    it("returns 500 on error", async () => {
      mockReq = { query: { portfolioId: "p", type: "t" }, user: { id: "u1" } };
      service.getQrCodesbyPortfolio.mockRejectedValue(new Error("db"));

      await controller.getQrCodesByPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("returns 400 when missing query", async () => {
      mockReq = { query: {}, user: { id: "u1" } };

      await controller.getQrCodesByPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("returns list", async () => {
      mockReq = { query: { portfolioId: "p", type: "t" }, user: { id: "u1" } };
      service.getQrCodesbyPortfolio.mockResolvedValue([]);

      await controller.getQrCodesByPortfolio(mockReq, mockRes);

      expect(service.getQrCodesbyPortfolio).toHaveBeenCalledWith("u1", "p", "t");
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });
});
