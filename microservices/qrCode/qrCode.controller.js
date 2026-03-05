// qrCode.controller.js
const service = require("./qrCode.service");

exports.getOnePublicQrCode = async (req, res) => {
  try {
    const qr = await service.getOnePublicQrCode(req.params.id);
    if (!qr) return res.status(404).json({ message: "QR code not found" });
    res.json(qr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicQrCodes = async (req, res) => {
  try {
    const filter = { active: true };

    if (req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }

    const qrCodes = await service.getPublicQrCodes(req.query.ownerId);
    res.json(qrCodes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicQrCodesByPortfolio = async (req, res) => {
  try {
    const { portfolioId, type } = req.query;
    console.log("getPublicQrCodesByPortfolio called with portfolioId:", portfolioId, "type:", type);
    if (!portfolioId || !type) {
      return res.status(400).json({ message: "Portfolio id and type are required" });
    }

    const qr = await service.getPublicQrCodesByPortfolio({ id: portfolioId, type });
    if (!qr) {
      return res.status(404).json({ message: "QR code not found" });
    }
    res.json(qr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getOneQrCode = async (req, res) => {
  try {
    const qr = await service.getOneQrCode(req.params.id, req.user.id);

    if (!qr) {
      return res.status(404).json({ message: "QR code not found" });
    }

    res.json(qr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.createQrCode = async (req, res) => {
  try {
    const qr = await service.createQrCode(req.body, req.user.id);
    res.status(201).json(qr);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateQrCode = async (req, res) => {
  try {
    const qr = await service.updateQrCode(req.params.id, req.user.id, req.body);
    if (!qr) {
      return res.status(404).json({ message: "QR code not found" });
    }
    res.json(qr);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

exports.deleteQrCode = async (req, res) => {
  try {
    const qr = await service.deleteQrCode(req.params.id, req.user.id);
    if (!qr) {
      return res.status(404).json({ message: "QR code not found" });
    }
    res.json({ message: "QR code deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


