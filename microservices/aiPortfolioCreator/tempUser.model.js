const mongoose = require("mongoose");

const { ProjectSchema } = require("./aiPortfolioCreator.model");

const tempUserSchema = new mongoose.Schema({
  userKey: { type: String, unique: true, index: true },
  email: { type: String, default: "om@test.local" },
  displayName: { type: String, default: "Om" },
  activeProjectId: { type: String, default: "" },
  projects: { type: [ProjectSchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

module.exports = mongoose.models.tempUser || mongoose.model("tempUser", tempUserSchema);
