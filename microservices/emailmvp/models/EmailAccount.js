const mongoose = require("mongoose");
const emailAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      default: "custom",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fromName: {
      type: String,
      trim: true,
    },
    fromEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    host: {
      type: String,
      required: true,
      trim: true,
    },
    port: {
      type: Number,
      required: true,
    },
    secure: {
      type: Boolean,
      default: false,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true, // ⚠️ plain text for MVP only
    },
  },
  {
    timestamps: true,
  }
);

const EmailAccount = mongoose.model("EmailAccount", emailAccountSchema);
module.exports = { EmailAccount };