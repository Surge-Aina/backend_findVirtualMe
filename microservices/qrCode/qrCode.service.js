// qrCode.service.js
const QrCode = require("./qrCode.model");

exports.getOnePublicQrCode = (id) =>
  QrCode.findOne({ _id: id, active: true });

exports.getPublicQrCodes = (owner) => {
  const filter = { active: true };
  if (owner) filter.owner = owner;
  return QrCode.find(filter);
};

exports.getOneQrCode = (id, ownerId) =>
  QrCode.findOne({ _id: id, ownerId });

exports.createQrCode = (data, ownerId) =>
  new QrCode({ ...data, ownerId }).save();

exports.updateQrCode = (id, ownerId, data) =>
  QrCode.findOneAndUpdate({ _id: id, ownerId }, data, { new: true });

exports.deleteQrCode = (id, ownerId) =>
  QrCode.findOneAndDelete({ _id: id, ownerId });