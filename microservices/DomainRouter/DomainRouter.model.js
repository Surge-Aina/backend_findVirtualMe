const mongoose = require("mongoose");

const DomainRouterSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    portfolioId: { type: String },

    portfolioSlug: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// lower case all domains
DomainRouterSchema.pre("save", function (next) {
  if (this.domain) {
    this.domain = this.domain.trim().toLowerCase();
  }
  next();
});

module.exports = mongoose.model("DomainRouter", DomainRouterSchema);
