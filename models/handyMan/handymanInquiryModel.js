const mongoose = require('mongoose');

const handymanInquirySchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'HandymanTemplate' },
  name:   { type: String,  required: true },
  email:  { type: String,  required: true },   // visitor's email
  phone:  { type: String },                    // visitor's phone (optional field in UI but useful)
  message:{ type: String,  required: true },
}, { timestamps: true });

const HandymanInquiry = mongoose.model('HandymanInquiry', handymanInquirySchema);
module.exports = HandymanInquiry;