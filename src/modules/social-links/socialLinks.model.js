const mongoose = require("mongoose");

const socialLinksSchema = new mongoose.Schema(
  {
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    links: {
      github: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SocialLinks", socialLinksSchema);
