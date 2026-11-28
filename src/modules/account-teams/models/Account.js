const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Workspace", trim: true },
    /** Set by migration for idempotent re-runs (one workspace per legacy owner). */
    createdFromOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true }
);

accountSchema.index({ createdFromOwner: 1 }, { unique: true, sparse: true });

module.exports =
  mongoose.models.Account || mongoose.model("Account", accountSchema, "accounts");