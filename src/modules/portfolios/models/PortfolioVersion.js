const mongoose = require("mongoose");
const { Schema } = mongoose;

const SectionSchema = new Schema(
  {
    type: { type: String, required: true },
    order: { type: Number, required: true },
    visible: { type: Boolean, default: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const snapshotSchema = new Schema(
  {
    title: { type: String, default: "" },
    slug: { type: String, default: "" },
    visibility: { type: String, enum: ["public", "private"], default: "private" },
    hideBranding: { type: Boolean, default: false },
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    themeId: { type: String, default: "" },
    themeTokens: { type: Schema.Types.Mixed, default: {} },
    layoutMode: {
      type: String,
      enum: ["auto", "singleSection", "stacked"],
      default: "auto",
    },
    pageBannerDefaults: { type: Schema.Types.Mixed, default: {} },
    navBrand: { type: Schema.Types.Mixed, default: {} },
    subUserSettings: { type: Schema.Types.Mixed, default: {} },
    sections: [SectionSchema],
  },
  { _id: false }
);

const portfolioVersionSchema = new Schema(
  {
    portfolioId: {
      type: Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true,
      index: true,
    },
    versionNumber: { type: Number, required: true },
    publishedAt: { type: Date, required: true, index: true },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: {
      type: String,
      enum: ["owner", "ai", "api"],
      default: "owner",
    },
    snapshot: { type: snapshotSchema, required: true },
  },
  { timestamps: true }
);

portfolioVersionSchema.index({ portfolioId: 1, versionNumber: -1 }, { unique: true });

module.exports =
  mongoose.models.PortfolioVersion ||
  mongoose.model("PortfolioVersion", portfolioVersionSchema, "portfolio_versions");