const mongoose = require('mongoose');

const OnboardingUserSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  location: {type: String },
  bio: { type: String },
  goal: { type: String },
  industry: { type: String},
  experienceLevel: { type: String },
  skills: [{ type: String }],
}, {timestamps: true});

module.exports = mongoose.model('onboardingUser', OnboardingUserSchema);