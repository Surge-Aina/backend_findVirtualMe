const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false, // we'll wire verification later
    }
  },
  {
    timestamps: true,
  }
);

const EmailMvpUser = mongoose.model("EmailMvpUser", userSchema);
module.exports = { EmailMvpUser };