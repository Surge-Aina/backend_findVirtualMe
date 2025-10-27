const mongoose = require("mongoose");

const guestUserSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  username: {
    type: String,
    trim: true,
  },
  portfolioType: {
    type: String,
    enum: [
      "project_manager",
      "handyman",
      "local_vendor",
      "cleaning_services",
      "photographer",
      "data_scientist",
      "healthcare",
    ],
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  loyaltyPoints: {
    type: Number,
    default: 0,
  },
  phone: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
});
//remove password before sending back to front end
guestUserSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password; // remove password when converting to JSON
    delete ret.__v; // remove __v version field
    return ret;
  },
});

module.exports = mongoose.model("guestUser", guestUserSchema);
