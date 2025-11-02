// aiPortfolioCreator.model.js
const mongoose = require("mongoose");

const LineMapSchema = new mongoose.Schema(
  { type: Map, of: String },
  { _id: false, strict: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, default: "active" }, // active | deleted
    frontendJson: new mongoose.Schema(
      { lines: LineMapSchema },
      { _id: false, strict: false }
    ),
    backendJson: new mongoose.Schema(
      { lines: LineMapSchema },
      { _id: false, strict: false }
    ),
    dataJson: {
      name: { type: String, default: "" },
    },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

module.exports = {
  ProjectSchema,
  ProjectModel: mongoose.model("Project", ProjectSchema),
};
