// qrCode.service.test.js
const QrCode = require("./qrCode.model");
const service = require("./qrCode.service");

jest.mock("./qrCode.model");

describe("QrCode Service", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // getOnePublicQrCode

  describe("getOnePublicQrCode", () => {
    it("calls findOne with the correct filter", () => {
      QrCode.findOne.mockResolvedValue({ _id: "abc123", active: true });

      service.getOnePublicQrCode("abc123");

      expect(QrCode.findOne).toHaveBeenCalledWith({
        _id: "abc123",
        active: true,
      });
    });

    it("returns the qr code when found", async () => {
      const mockQr = { _id: "abc123", active: true };
      QrCode.findOne.mockResolvedValue(mockQr);

      const result = await service.getOnePublicQrCode("abc123");

      expect(result).toEqual(mockQr);
    });

    it("returns null when not found", async () => {
      QrCode.findOne.mockResolvedValue(null);

      const result = await service.getOnePublicQrCode("notfound");

      expect(result).toBeNull();
    });
  });

  // getPublicQrCodes

  describe("getPublicQrCodes", () => {
    it("filters by active: true only when no owner is provided", () => {
      QrCode.find.mockResolvedValue([]);

      service.getPublicQrCodes();

      expect(QrCode.find).toHaveBeenCalledWith({ active: true });
    });

    it("includes owner in the filter when owner is provided", () => {
      QrCode.find.mockResolvedValue([]);

      service.getPublicQrCodes("user99");

      expect(QrCode.find).toHaveBeenCalledWith({
        active: true,
        owner: "user99",
      });
    });

    it("returns an array of qr codes", async () => {
      const mockCodes = [
        { _id: "1", active: true },
        { _id: "2", active: true },
      ];
      QrCode.find.mockResolvedValue(mockCodes);

      const result = await service.getPublicQrCodes();

      expect(result).toEqual(mockCodes);
    });

    it("returns an empty array when there are no results", async () => {
      QrCode.find.mockResolvedValue([]);

      const result = await service.getPublicQrCodes("unknownOwner");

      expect(result).toEqual([]);
    });
  });

  // getOneQrCode

  describe("getOneQrCode", () => {
    it("calls findOne with id and ownerId", () => {
      QrCode.findOne.mockResolvedValue({ _id: "abc123", ownerId: "user1" });

      service.getOneQrCode("abc123", "user1");

      expect(QrCode.findOne).toHaveBeenCalledWith({
        _id: "abc123",
        ownerId: "user1",
      });
    });

    it("returns the qr code when found", async () => {
      const mockQr = { _id: "abc123", ownerId: "user1" };
      QrCode.findOne.mockResolvedValue(mockQr);

      const result = await service.getOneQrCode("abc123", "user1");

      expect(result).toEqual(mockQr);
    });

    it("returns null when the qr code belongs to a different owner", async () => {
      QrCode.findOne.mockResolvedValue(null);

      const result = await service.getOneQrCode("abc123", "wrongUser");

      expect(result).toBeNull();
    });
  });

  // createQrCode 

  describe("createQrCode", () => {
    it("constructs a QrCode with the provided data and ownerId", () => {
      const mockSave = jest.fn().mockResolvedValue({});
      QrCode.mockImplementation(() => ({ save: mockSave }));

      service.createQrCode({ name: "My QR" }, "user1");

      expect(QrCode).toHaveBeenCalledWith({ name: "My QR", ownerId: "user1" });
    });

    it("calls save and returns the saved document", async () => {
      const savedDoc = { _id: "new1", name: "My QR", ownerId: "user1" };
      const mockSave = jest.fn().mockResolvedValue(savedDoc);
      QrCode.mockImplementation(() => ({ save: mockSave }));

      const result = await service.createQrCode({ name: "My QR" }, "user1");

      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(savedDoc);
    });

    it("ownerId in data is overwritten by the explicit ownerId argument", () => {
      const mockSave = jest.fn().mockResolvedValue({});
      QrCode.mockImplementation(() => ({ save: mockSave }));

      service.createQrCode({ name: "My QR", ownerId: "sneaky" }, "realOwner");

      // Spread puts data first, then ownerId overwrites
      expect(QrCode).toHaveBeenCalledWith({
        name: "My QR",
        ownerId: "realOwner",
      });
    });
  });

  // updateQrCode

  describe("updateQrCode", () => {
    it("calls findOneAndUpdate with the correct arguments", () => {
      QrCode.findOneAndUpdate.mockResolvedValue({ _id: "abc123" });

      service.updateQrCode("abc123", "user1", { name: "Updated" });

      expect(QrCode.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "abc123", ownerId: "user1" },
        { name: "Updated" },
        { new: true }
      );
    });

    it("returns the updated document", async () => {
      const updated = { _id: "abc123", name: "Updated" };
      QrCode.findOneAndUpdate.mockResolvedValue(updated);

      const result = await service.updateQrCode("abc123", "user1", {
        name: "Updated",
      });

      expect(result).toEqual(updated);
    });

    it("returns null when no matching document is found", async () => {
      QrCode.findOneAndUpdate.mockResolvedValue(null);

      const result = await service.updateQrCode("abc123", "wrongUser", {
        name: "Updated",
      });

      expect(result).toBeNull();
    });
  });

  // deleteQrCode 

  describe("deleteQrCode", () => {
    it("calls findOneAndDelete with id and ownerId", () => {
      QrCode.findOneAndDelete.mockResolvedValue({ _id: "abc123" });

      service.deleteQrCode("abc123", "user1");

      expect(QrCode.findOneAndDelete).toHaveBeenCalledWith({
        _id: "abc123",
        ownerId: "user1",
      });
    });

    it("returns the deleted document", async () => {
      const deleted = { _id: "abc123", name: "Gone" };
      QrCode.findOneAndDelete.mockResolvedValue(deleted);

      const result = await service.deleteQrCode("abc123", "user1");

      expect(result).toEqual(deleted);
    });

    it("returns null when no matching document is found", async () => {
      QrCode.findOneAndDelete.mockResolvedValue(null);

      const result = await service.deleteQrCode("abc123", "wrongUser");

      expect(result).toBeNull();
    });
  });
});