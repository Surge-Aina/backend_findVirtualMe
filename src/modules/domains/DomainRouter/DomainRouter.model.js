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

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    portfolioType: {
      type: String,
      trim: true,
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
    this.domain = this.domain.trim().toLowerCase().replace(/^www\./, "");
  }
  next();
});

// Indexes
DomainRouteSchema.index({ userId: 1 });
DomainRouteSchema.index({ portfolioId: 1 });
DomainRouteSchema.index({ isActive: 1 });

const DomainRoute = mongoose.model("DomainRoute", DomainRouteSchema);

module.exports = DomainRoute;
module.exports.DomainRouteSchema = DomainRouteSchema;
