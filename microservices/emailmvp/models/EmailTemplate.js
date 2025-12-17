// src/models/EmailTemplate.js
const mongoose = require("mongoose");

const EmailTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // null/undefined for system templates
    },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },

    // e.g. ["name", "amount", "subject"]
    variables: [{ type: String }],

    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const EmailTemplate = mongoose.model("EmailTemplate", EmailTemplateSchema);
module.exports = { EmailTemplate };