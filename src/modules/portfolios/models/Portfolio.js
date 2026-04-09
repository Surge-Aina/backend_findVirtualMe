const mongoose = require("mongoose");
const { Schema } = mongoose;

const SectionSchema = new Schema(
  {
    type: { type: String, required: true },
    order: { type: Number, required: true },
    visible: { type: Boolean, default: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const portfolioSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    title: { type: String, default: "" },
    template: {
      type: String,
      required: true,
      index: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    createdBy: {
      type: String,
      enum: ["user", "agent"],
      default: "user",
      index: true,
    },
    generationModel: { type: String, default: "" },
    generationVersion: { type: String, default: "" },
    generationPromptHash: { type: String, default: "" },
    themeId: { type: String, default: "" },
    themeTokens: { type: Schema.Types.Mixed, default: {} },
    layoutMode: {
      type: String,
      enum: ["auto", "singleSection", "stacked"],
      default: "auto",
    },
    hideBranding: { type: Boolean, default: false },
    pageBannerDefaults: { type: Schema.Types.Mixed, default: {} },
    navBrand: {
      mode: { type: String, enum: ["none", "icon", "initials"], default: "none" },
      iconKey: { type: String, default: "" },
      initialsText: { type: String, default: "", maxlength: 2 },
      initialsFill: { type: String, enum: ["color", "image"], default: "color" },
      initialsBgColor: { type: String, default: "#2563eb" },
      initialsBgImageUrl: { type: String, default: "" },
    },
    socialLinks: {
      github: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      website: { type: String, default: "" },
    },
    sections: [SectionSchema],
  },
  { timestamps: true }
);

portfolioSchema.index({ owner: 1, template: 1 });
portfolioSchema.index({ visibility: 1, template: 1 });

module.exports =
  mongoose.models.Portfolio ||
  mongoose.model("Portfolio", portfolioSchema, "portfolios_v2");
