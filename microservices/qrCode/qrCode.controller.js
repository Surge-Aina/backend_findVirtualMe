// qrCode.controller.js
const QrCode = require("./qrCode.model");

exports.getOnePublicQrCode = async (req, res) => {
  try {
    const qr = await QrCode.findOne({ 
      _id: req.params.id, 
      active: true 
    });

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

    if (req.query.owner) {
      filter.owner = req.query.owner;
    }

    const qrCodes = await QrCode.find(filter);
    res.json(qrCodes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getOneQrCode = async (req, res) => {
  try {
    const qr = await QrCode.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

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
    const qr = new QrCode({ 
      ...req.body,
      ownerId: req.user._id // from auth middleware
    });
    const saved = await qr.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateQrCode = async (req, res) => {
  try {
    const qr = await QrCode.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id },
      req.body,
      { new: true }
    );

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
    const qr = await QrCode.findOneAndDelete({ 
      _id: req.params.id, 
      ownerId: req.user.id 
    });
    
    if (!qr) return res.status(404).json({ message: "QR code not found" });
    
    res.json({ message: "QR code deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


