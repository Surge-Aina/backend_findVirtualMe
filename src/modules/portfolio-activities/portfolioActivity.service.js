const mongoose = require("mongoose");
const PortfolioActivity = require("./models/PortfolioActivity");
const Portfolio = require("../portfolios/models/Portfolio");
const GuestUser = require("../auth/guestLogin/guestUser.model");
const User = require("../../shared/models/User");
const { assertPortfolioOwner } = require("../portfolios/portfolio.service");
const {
  notifyOwnerOfNewActivityRequest,
  notifySubUserOfActivityDecision,
} = require("./activityNotifications");

class ActivityError extends Error {
  constructor(message, status = 400, code = "ACTIVITY_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const SUB_USER_VISIBLE_FIELDS =
  "_id portfolioId portfolioUserId type status serviceRef serviceLabel scheduledFor completedAt notes data createdBy createdAt updatedAt";

function isValidObjectId(id) {
  return !!id && mongoose.Types.ObjectId.isValid(id);
}

async function loadPortfolioOrThrow(portfolioId) {
  if (!isValidObjectId(portfolioId)) {
    throw new ActivityError("Invalid portfolioId", 400, "INVALID_PORTFOLIO_ID");
  }
  const portfolio = await Portfolio.findById(portfolioId).lean();
  if (!portfolio) {
    throw new ActivityError("Portfolio not found", 404, "PORTFOLIO_NOT_FOUND");
  }
  return portfolio;
}

function sanitizeForSubUser(activity) {
  if (!activity) return null;
  const obj = activity.toObject ? activity.toObject() : activity;
  const { ownerNotes, ...rest } = obj;
  return rest;
}

/**
 * Sub-user creates a request-style activity for their own portfolio.
 * Status defaults to `pending`; owner notification is fired-and-forget.
 */
async function createByPortfolioUser(portfolioUser, payload) {
  if (!portfolioUser?._id) {
    throw new ActivityError("Authentication required", 401, "UNAUTHENTICATED");
  }
  const portfolioId = portfolioUser.portfolioId;
  if (!portfolioId) {
    throw new ActivityError(
      "Sub-user is not bound to a portfolio",
      400,
      "MISSING_PORTFOLIO_BINDING"
    );
  }

  const portfolio = await loadPortfolioOrThrow(portfolioId);

  const doc = await PortfolioActivity.create({
    portfolioId: portfolio._id,
    portfolioUserId: portfolioUser._id,
    type: payload.type || "visit",
    status: "pending",
    serviceRef: payload.serviceRef || "",
    serviceLabel: payload.serviceLabel || "",
    scheduledFor: payload.scheduledFor || undefined,
    notes: payload.notes || "",
    data: payload.data || {},
    createdBy: "portfolioUser",
  });

  // Fire-and-forget so failures never block the API.
  notifyOwnerOfNewActivityRequest({ portfolio, portfolioUser, activity: doc }).catch(
    (err) => console.error("[portfolio-activities] owner notify failed:", err?.message || err)
  );

  return sanitizeForSubUser(doc);
}

/** Sub-user lists their own activities scoped to their bound portfolio. */
async function listForPortfolioUser(portfolioUser, query = {}) {
  if (!portfolioUser?._id) {
    throw new ActivityError("Authentication required", 401, "UNAUTHENTICATED");
  }
  const filter = {
    portfolioUserId: portfolioUser._id,
    portfolioId: portfolioUser.portfolioId,
  };
  if (query.status) filter.status = query.status;
  const docs = await PortfolioActivity.find(filter)
    .select(SUB_USER_VISIBLE_FIELDS)
    .sort({ scheduledFor: -1, createdAt: -1 })
    .lean();
  return docs;
}

/** Sub-user cancels their own pending request. */
async function cancelByPortfolioUser(portfolioUser, activityId) {
  if (!portfolioUser?._id) {
    throw new ActivityError("Authentication required", 401, "UNAUTHENTICATED");
  }
  if (!isValidObjectId(activityId)) {
    throw new ActivityError("Invalid activityId", 400, "INVALID_ACTIVITY_ID");
  }
  const doc = await PortfolioActivity.findById(activityId);
  if (!doc) {
    throw new ActivityError("Activity not found", 404, "ACTIVITY_NOT_FOUND");
  }
  if (doc.portfolioUserId.toString() !== portfolioUser._id.toString()) {
    throw new ActivityError("Forbidden", 403, "FORBIDDEN");
  }
  if (doc.status !== "pending") {
    throw new ActivityError(
      "Only pending activities can be cancelled by the requester",
      400,
      "INVALID_STATUS_TRANSITION"
    );
  }

  // Owner must explicitly allow self-cancellation in their portfolio
  // settings. Otherwise sub-users can only request changes via the owner.
  const portfolio = await Portfolio.findById(doc.portfolioId)
    .select("subUserSettings")
    .lean();
  if (!portfolio?.subUserSettings?.allowBookingCancellation) {
    throw new ActivityError(
      "Cancellation is disabled for this portfolio. Please contact the provider.",
      403,
      "CANCELLATION_NOT_ALLOWED"
    );
  }

  doc.status = "cancelled";
  await doc.save();
  return sanitizeForSubUser(doc);
}

/** Owner lists activities for a portfolio they own. */
async function listForOwner(ownerUserId, query = {}) {
  const { portfolioId, status, portfolioUserId } = query;
  const check = await assertPortfolioOwner(portfolioId, ownerUserId);
  if (!check.ok) {
    throw new ActivityError(check.error, check.status, "OWNER_CHECK_FAILED");
  }
  const filter = { portfolioId };
  if (status) filter.status = status;
  if (portfolioUserId && isValidObjectId(portfolioUserId)) {
    filter.portfolioUserId = portfolioUserId;
  }
  const docs = await PortfolioActivity.find(filter)
    .sort({ scheduledFor: -1, createdAt: -1 })
    .lean();
  return docs;
}

/** Owner manually creates an activity (e.g. records a past visit). */
async function createByOwner(ownerUserId, payload) {
  const { portfolioId, portfolioUserId } = payload;
  const check = await assertPortfolioOwner(portfolioId, ownerUserId);
  if (!check.ok) {
    throw new ActivityError(check.error, check.status, "OWNER_CHECK_FAILED");
  }
  if (!isValidObjectId(portfolioUserId)) {
    throw new ActivityError("Invalid portfolioUserId", 400, "INVALID_SUB_USER_ID");
  }
  const subUser = await GuestUser.findById(portfolioUserId);
  if (!subUser) {
    throw new ActivityError("Sub-user not found", 404, "SUB_USER_NOT_FOUND");
  }
  if (
    subUser.portfolioId &&
    subUser.portfolioId.toString() !== portfolioId.toString()
  ) {
    throw new ActivityError(
      "Sub-user does not belong to this portfolio",
      400,
      "SUB_USER_PORTFOLIO_MISMATCH"
    );
  }

  const status =
    payload.status && PortfolioActivity.ACTIVITY_STATUSES.includes(payload.status)
      ? payload.status
      : "confirmed";

  const doc = await PortfolioActivity.create({
    portfolioId,
    portfolioUserId,
    type: payload.type || "visit",
    status,
    serviceRef: payload.serviceRef || "",
    serviceLabel: payload.serviceLabel || "",
    scheduledFor: payload.scheduledFor || undefined,
    completedAt: status === "completed" ? payload.completedAt || new Date() : undefined,
    notes: payload.notes || "",
    ownerNotes: payload.ownerNotes || "",
    data: payload.data || {},
    createdBy: "owner",
  });

  return doc.toObject();
}

const OWNER_EDITABLE_FIELDS = [
  "type",
  "status",
  "serviceRef",
  "serviceLabel",
  "scheduledFor",
  "completedAt",
  "notes",
  "ownerNotes",
  "data",
];

/** Owner approves / reschedules / declines / completes an activity. */
async function updateByOwner(ownerUserId, activityId, updates) {
  if (!isValidObjectId(activityId)) {
    throw new ActivityError("Invalid activityId", 400, "INVALID_ACTIVITY_ID");
  }
  const doc = await PortfolioActivity.findById(activityId);
  if (!doc) {
    throw new ActivityError("Activity not found", 404, "ACTIVITY_NOT_FOUND");
  }
  const check = await assertPortfolioOwner(doc.portfolioId, ownerUserId);
  if (!check.ok) {
    throw new ActivityError(check.error, check.status, "OWNER_CHECK_FAILED");
  }

  const previousStatus = doc.status;

  for (const key of OWNER_EDITABLE_FIELDS) {
    if (updates[key] !== undefined) {
      if (key === "status" && !PortfolioActivity.ACTIVITY_STATUSES.includes(updates.status)) {
        throw new ActivityError(
          `Invalid status: ${updates.status}`,
          400,
          "INVALID_STATUS"
        );
      }
      doc[key] = updates[key];
    }
  }

  if (doc.status === "completed" && !doc.completedAt) {
    doc.completedAt = new Date();
  }

  await doc.save();

  if (updates.status && updates.status !== previousStatus) {
    const [portfolio, subUser] = await Promise.all([
      Portfolio.findById(doc.portfolioId).lean(),
      GuestUser.findById(doc.portfolioUserId).lean(),
    ]);
    notifySubUserOfActivityDecision({
      portfolio,
      subUser,
      activity: doc,
      previousStatus,
    }).catch((err) =>
      console.error("[portfolio-activities] sub-user notify failed:", err?.message || err)
    );
  }

  return doc.toObject();
}

module.exports = {
  ActivityError,
  createByPortfolioUser,
  listForPortfolioUser,
  cancelByPortfolioUser,
  listForOwner,
  createByOwner,
  updateByOwner,
};
