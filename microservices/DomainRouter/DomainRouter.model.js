const mongoose = require("mongoose");

const DomainRouteSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Owner of the portfolio
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Embedded portfolio ID inside user.portfolios[]
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Normalize domain
DomainRouteSchema.pre("save", function (next) {
  if (this.domain) {
    this.domain = this.domain.trim().toLowerCase();
  }
  next();
});

// Indexes
DomainRouteSchema.index({ domain: 1 }, { unique: true });
DomainRouteSchema.index({ userId: 1 });
DomainRouteSchema.index({ portfolioId: 1 });
DomainRouteSchema.index({ isActive: 1 });

module.exports = mongoose.model("DomainRoute", DomainRouteSchema);
