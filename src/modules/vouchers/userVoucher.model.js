const mongoose = require("mongoose");

const userVoucherSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Vouchers", required: true },
    status: { type: String, enum: ["active", "redeemed", "expired"], default: "active" },
    grantedAt: { type: Date, default: Date.now },
    redeemedAt: { type: Date },
    metadata: { type: Object }, // For any additional info like subscriptionId, domain, etc.
}, { timestamps: true });

userVoucherSchema.index({ userId: 1, voucherId: 1 }, { unique: true }); // Prevent duplicate vouchers for the same user

// Check if the model exists before compiling to avoid OverwriteModelError in tests
const UserVoucher = mongoose.models.UserVoucher || mongoose.model("UserVoucher", userVoucherSchema);

//use userVoucherSchema for tests and UserVoucher for actual code to avoid model overwrite issues in tests
module.exports = { UserVoucher, userVoucherSchema };