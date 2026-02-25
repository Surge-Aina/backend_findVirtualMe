// models/userModel.js
const mongoose = require('mongoose');

const userSchema2 = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // store bcrypt hash here for new users.
    // For your existing admin (currently plaintext)
    password: {
      type: String,
      required: true,
    },
    // NEW: distinguish admin vs. customer
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User2', userSchema2, 'cleaning');

