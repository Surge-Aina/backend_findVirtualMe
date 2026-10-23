// qrCode.service.js
const QrCode = require("./qrCode.model");

exports.getOnePublicQrCode = (id) =>
  QrCode.findOne({ _id: id, active: true });

exports.getPublicQrCodes = (ownerId) => {
  const filter = { active: true };
  if (ownerId) filter.ownerId = ownerId;
  return QrCode.find(filter);
};

exports.getPublicQrCodesByPortfolio = (portf) => {
  const filter = { active: true, "portfolio.id": portf.id, "portfolio.type": portf.type };
  return QrCode.find(filter);
};

// ===================public above pricate below========================

exports.getOneQrCode = (id, ownerId) =>
  QrCode.findOne({ _id: id, ownerId });

exports.getQrCodesbyPortfolio = (ownerId, portfolioId, type) => {
  const filter = { ownerId };
  if (portfolioId) filter["portfolio.id"] = portfolioId;
  if (type) filter["portfolio.type"] = type;
  return QrCode.find(filter);
};

exports.createQrCode = (data, ownerId) =>
  new QrCode({ ...data, ownerId }).save();

exports.updateQrCode = (id, ownerId, data) =>
  QrCode.findOneAndUpdate({ _id: id, ownerId }, data, { new: true });

exports.deleteQrCode = (id, ownerId) =>
  QrCode.findOneAndDelete({ _id: id, ownerId });

exports.toggleActiveQrCode = async (id, ownerId) => {
  try {
    const qr = await QrCode.findOne({ _id: id, ownerId });
    if (!qr) {
      throw new Error("QR code not found");
    }
    qr.active = !qr.active;
    return await qr.save();
  } catch (err) {
    throw new Error(err.message);
  }
};
