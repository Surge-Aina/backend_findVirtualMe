const mongoose = require("mongoose");

const ROLES = ["account_admin", "editor", "viewer"];

const membershipSchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "invited"],
      default: "active",
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

membershipSchema.index({ account: 1, user: 1 }, { unique: true, sparse: true });
membershipSchema.index({ account: 1, email: 1 }, { unique: true });

module.exports =
  mongoose.models.AccountMembership ||
  mongoose.model("AccountMembership", membershipSchema, "account_memberships");

module.exports.MEMBERSHIP_ROLES = ROLES;