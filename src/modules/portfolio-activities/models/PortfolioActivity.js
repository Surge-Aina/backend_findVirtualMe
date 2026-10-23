const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * PortfolioActivity is a generalized record of a sub-user's interaction with
 * a portfolio (e.g. healthcare visit, service request, booked appointment).
 * The `type` + `data` shape mirrors the portfolio sections architecture so
 * additional templates can store template-specific payloads without schema
 * changes.
 */
const ACTIVITY_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "declined",
  "cancelled",
];

const portfolioActivitySchema = new Schema(
  {
    portfolioId: {
      type: Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true,
      index: true,
    },
    portfolioUserId: {
      type: Schema.Types.ObjectId,
      ref: "guestUser",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      default: "visit",
    },
    status: {
      type: String,
      enum: ACTIVITY_STATUSES,
      default: "pending",
      index: true,
    },
    serviceRef: {
      type: String,
      default: "",
    },
    serviceLabel: {
      type: String,
      default: "",
    },
    scheduledFor: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    notes: {
      type: String,
      default: "",
    },
    /** Owner-only notes never returned to sub-user. */
    ownerNotes: {
      type: String,
      default: "",
    },
    /** Template-specific payload (mirrors Portfolio.section.data). */
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: String,
      enum: ["owner", "portfolioUser"],
      required: true,
    },
  },
  { timestamps: true }
);

portfolioActivitySchema.index({ portfolioId: 1, portfolioUserId: 1, scheduledFor: -1 });
portfolioActivitySchema.index({ portfolioId: 1, status: 1, scheduledFor: -1 });

const PortfolioActivity =
  mongoose.models.PortfolioActivity ||
  mongoose.model("PortfolioActivity", portfolioActivitySchema, "portfolio_activities");

module.exports = PortfolioActivity;
module.exports.ACTIVITY_STATUSES = ACTIVITY_STATUSES;
