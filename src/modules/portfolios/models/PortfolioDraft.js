const mongoose = require("mongoose");
const { Schema } = mongoose;

const SectionSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    type: { type: String, required: true },
    order: { type: Number, required: true },
    visible: { type: Boolean, default: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const externalRefSchema = new Schema(
  {
    kind: { type: String, default: "" },
    refId: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * One working draft (change proposal) per portfolio. Future sources (AI, API, PR patch)
 * reuse the same document shape via `source`, `approvalState`, and `externalRef`.
 */
const portfolioDraftSchema = new Schema(
  {
    portfolioId: {
      type: Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true,
      unique: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["owner", "ai", "api"],
      default: "owner",
      index: true,
    },
    approvalState: {
      type: String,
      enum: ["pending_owner", "approved", "rejected"],
      default: "pending_owner",
      index: true,
    },
    externalRef: { type: externalRefSchema, default: () => ({}) },
    title: { type: String, default: "" },
    slug: { type: String, default: "" },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    hideBranding: { type: Boolean, default: false },
    socialLinks: {
      github: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      website: { type: String, default: "" },
    },
    themeId: { type: String, default: "" },
    themeTokens: { type: Schema.Types.Mixed, default: {} },
    layoutMode: {
      type: String,
      enum: ["auto", "singleSection", "stacked"],
      default: "auto",
    },
    pageBannerDefaults: { type: Schema.Types.Mixed, default: {} },
    navBrand: {
      mode: { type: String, enum: ["none", "icon", "initials"], default: "none" },
      iconKey: { type: String, default: "" },
      initialsText: { type: String, default: "", maxlength: 2 },
      initialsFill: { type: String, enum: ["color", "image"], default: "color" },
      initialsBgColor: { type: String, default: "#2563eb" },
      initialsBgImageUrl: { type: String, default: "" },
    },
    subUserSettings: {
      allowBookingCancellation: { type: Boolean, default: false },
    },
    sections: [SectionSchema],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PortfolioDraft ||
  mongoose.model("PortfolioDraft", portfolioDraftSchema, "portfolio_drafts");