const mongoose = require("mongoose");

const workflowTriggerSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Portfolio", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appId: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformApp", default: null },
    installationId: { type: mongoose.Schema.Types.ObjectId, ref: "Installation", default: null },
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    samplePayload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

workflowTriggerSchema.index({ siteId: 1, key: 1 }, { unique: true });

const WorkflowTrigger =
  mongoose.models.WorkflowTrigger ||
  mongoose.model("WorkflowTrigger", workflowTriggerSchema, "site_workflow_triggers");

module.exports = WorkflowTrigger;
