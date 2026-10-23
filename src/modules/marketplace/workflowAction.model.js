const mongoose = require("mongoose");

const workflowActionSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Portfolio", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appId: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformApp", default: null },
    installationId: { type: mongoose.Schema.Types.ObjectId, ref: "Installation", default: null },
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    targetUrl: { type: String, required: true },
    keyVersion: { type: String, required: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    secretLast4: { type: String, required: true },
  },
  { timestamps: true }
);

workflowActionSchema.index({ siteId: 1, key: 1 }, { unique: true });

const WorkflowAction =
  mongoose.models.WorkflowAction ||
  mongoose.model("WorkflowAction", workflowActionSchema, "site_workflow_actions");

module.exports = WorkflowAction;
