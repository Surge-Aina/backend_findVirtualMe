const mongoose = require('mongoose');

const handymanInquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
}, { timestamps: true });

const HandymanInquiry = mongoose.model('HandymanInquiry', handymanInquirySchema);

module.exports = HandymanInquiry;
