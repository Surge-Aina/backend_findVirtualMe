// vouchers.model.js
const mongoose = require("mongoose");

const vouchersSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["discount", "free_domain"], required: true },
  code: { type: String},
  discountAmount: { type: Number }, 
  discountPercentage: { type: Number }, 
  autoGrantOn: { type: String, enum: ["first_subscription", "anniversary", "manual"] },
  expiresAt: { type: Date },
  singleUse: { type: Boolean, default: true },
}, { timestamps: true });

// Check if the model exists before compiling to avoid OverwriteModelError in tests
const Voucher = mongoose.models.Vouchers || mongoose.model("Vouchers", vouchersSchema);

//use vouchersSchema for tests and Voucher for actual code to avoid model overwrite issues in tests
module.exports = { Voucher, vouchersSchema };