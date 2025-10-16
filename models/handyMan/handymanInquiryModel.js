const mongoose = require('mongoose');

const handymanInquirySchema = new mongoose.Schema(
  {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'HandymanTemplate' },

    name:   { type: String, required: true },
    email:  { type: String, required: true },
    phone:  { type: String },
    message:{ type: String, required: true },

    // ✅ Multi-select snapshot
    selectedServiceTitles: { type: [String],  default: [] },
    selectedServicePrices: { type: [Number],  default: [] },
    selectedServiceTotal:  { type: Number,    default: 0 },

  },
  { timestamps: true }
);

module.exports = mongoose.model('HandymanInquiry', handymanInquirySchema);
