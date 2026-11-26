const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const ContactMeForm = require("../contact/contactMeForm.model");
const User = require("../../shared/models/User");
const { notifyLeadCaptured, notifyFormSubmitted } = require("../public-api/lifecycleEvents");
const { consentContactFromBody } = require("../public-api/leadConsent");
const { sendGenericContactEmails } = require("../../shared/services/emailService");
const { isFeatureComponentBookingEnabled } = require("../../shared/config/featureComponentBooking");
const { isSiteDraftsEnabled } = require("../../shared/config/siteDrafts");
const { sectionDataToPuckProps } = require("../portfolios/models/featureComponentAdapters");
const {
  validateRequestedWindow,
  clampMinNoticeHours,
  clampDaysAheadMax,
} = require("./bookingWindow");
const { validatePublicBookingFields } = require("./bookingRequest.validation");
const { BookingRequestError } = require("./bookingRequest.errors");

function bookingRulesFromSection(section) {
  const data = section?.data && typeof section.data === "object" ? section.data : {};
  const puck = sectionDataToPuckProps("BookingRequest", data, "");
  const minNoticeHours = clampMinNoticeHours(puck.minNoticeHours ?? data.minNoticeHours ?? 24);
  const daysAheadMax = clampDaysAheadMax(puck.daysAheadMax ?? data.daysAheadMax ?? 30);
  return {
    minNoticeHours,
    daysAheadMax,
    timezone: puck.timezone || data.timezone || "America/New_York",
    services: Array.isArray(puck.services)
      ? puck.services
          .map((s) => (typeof s === "string" ? s : s?.name))
          .map((s) => String(s || "").trim())
          .filter(Boolean)
      : Array.isArray(data.services)
        ? data.services
            .map((s) => (typeof s === "string" ? s : s?.name))
            .map((s) => String(s || "").trim())
            .filter(Boolean)
        : [],
    confirmationText: puck.confirmationText || data.confirmationText || "",
  };
}

function findPublishedBookingSection(portfolio, sectionId) {
  if (!sectionId || typeof sectionId !== "string") {
    throw new BookingRequestError("Booking section not found", {
      status: 404,
      code: "not_found",
      details: { field: "sectionId" },
    });
  }
  if (!mongoose.isValidObjectId(sectionId)) {
    throw new BookingRequestError("Booking section not found", {
      status: 404,
      code: "not_found",
      details: { field: "sectionId" },
    });
  }
  const match = (portfolio.sections || []).find(
    (s) =>
      String(s._id) === String(sectionId) &&
      s.type === "bookingRequest" &&
      s.visible !== false
  );
  if (!match) {
    throw new BookingRequestError("Booking section not found", {
      status: 404,
      code: "not_found",
      details: { field: "sectionId" },
    });
  }
  return match;
}

async function loadPublicPublishedPortfolio(portfolioId) {
  if (!portfolioId || !mongoose.isValidObjectId(portfolioId)) {
    throw new BookingRequestError("Site not found", { status: 404, code: "not_found" });
  }
  const portfolio = await Portfolio.findById(portfolioId).lean();
  if (!portfolio || portfolio.visibility !== "public") {
    throw new BookingRequestError("Site not found", { status: 404, code: "not_found" });
  }
  if (isSiteDraftsEnabled() && (portfolio.publishedVersionNumber || 0) < 1) {
    throw new BookingRequestError("Site not found", { status: 404, code: "not_found" });
  }
  return portfolio;
}

function validateServiceChoice(service, allowed) {
  const trimmed = typeof service === "string" ? service.trim() : "";
  if (!allowed.length) {
    return trimmed || "General request";
  }
  if (!trimmed) {
    throw new BookingRequestError("service is required", {
      code: "validation_error",
      details: { field: "service" },
    });
  }
  if (!allowed.includes(trimmed)) {
    throw new BookingRequestError("service is not offered", {
      code: "validation_error",
      details: { field: "service" },
    });
  }
  return trimmed;
}

function formatBookingMessage({ service, start, end, timezone, visitorMessage }) {
  const lines = [
    "Booking request (not a confirmed appointment).",
    `Service: ${service}`,
    `Requested window (${timezone}): ${start.toISO()} – ${end.toISO()}`,
  ];
  if (visitorMessage) {
    lines.push(`Notes: ${visitorMessage}`);
  }
  const message = lines.join("\n");
  if (message.length > 2000) {
    throw new BookingRequestError("message exceeds maximum length", {
      code: "validation_error",
      details: { field: "message", max: 2000 },
    });
  }
  return message;
}

async function resolveSiteOwner(portfolio) {
  const owner = await User.findById(portfolio.owner).select("email name username").lean();
  const ownerEmail = owner?.email;
  const ownerName = owner?.name || owner?.username;
  if (!ownerEmail || !ownerName) {
    throw new BookingRequestError("Owner contact could not be resolved", {
      code: "validation_error",
    });
  }
  return { ownerEmail, ownerName };
}

async function submitBookingRequest(body) {
  if (!isFeatureComponentBookingEnabled()) {
    throw new BookingRequestError("Booking requests are not enabled", {
      status: 404,
      code: "FEATURE_COMPONENT_BOOKING_DISABLED",
    });
  }

  const fields = validatePublicBookingFields(body);
  const { portfolioId, sectionId, requestedStart, requestedEnd } = body;

  if (!portfolioId || !requestedStart || !requestedEnd) {
    throw new BookingRequestError(
      "portfolioId, requestedStart, and requestedEnd are required",
      { code: "validation_error" }
    );
  }

  const portfolio = await loadPublicPublishedPortfolio(portfolioId);
  const section = findPublishedBookingSection(portfolio, sectionId);
  const rules = bookingRulesFromSection(section);

  let window;
  try {
    window = validateRequestedWindow({
      requestedStart,
      requestedEnd,
      minNoticeHours: rules.minNoticeHours,
      daysAheadMax: rules.daysAheadMax,
      timezone: rules.timezone,
    });
  } catch (err) {
    if (err.name === "BookingWindowError" || err.name === "TimezoneValidationError") {
      throw new BookingRequestError(err.message, {
        code: err.code || "validation_error",
        details: err.details || (err.path ? { field: err.path } : undefined),
      });
    }
    throw err;
  }

  const serviceLabel = validateServiceChoice(fields.service, rules.services);
  const { ownerEmail, ownerName } = await resolveSiteOwner(portfolio);
  const portfolioType = portfolio.template || undefined;
  const consentContact = consentContactFromBody(body);
  const message = formatBookingMessage({
    service: serviceLabel,
    start: window.start,
    end: window.end,
    timezone: rules.timezone,
    visitorMessage: fields.message,
  });

  const contact = await ContactMeForm.create({
    portfolioId,
    portfolioType,
    ownerEmail,
    ownerName,
    name: fields.name,
    email: fields.email,
    phone: fields.phone || undefined,
    message,
    leadType: "booking",
    bookingService: serviceLabel,
    bookingRequestedStart: window.start.toJSDate(),
    bookingRequestedEnd: window.end.toJSDate(),
    bookingTimezone: rules.timezone,
    bookingSectionId: section._id,
    status: "new",
    ...(consentContact === undefined ? {} : { consentContact }),
  });

  const leadId = contact._id.toString();
  const consent = consentContact === undefined ? null : { contact: consentContact };
  notifyLeadCaptured({
    siteId: portfolioId,
    leadId,
    email: fields.email,
    name: fields.name,
    consent,
    createdAt: contact.createdAt,
  });
  notifyFormSubmitted({
    siteId: portfolioId,
    leadId,
    form: "booking",
    email: fields.email,
    name: fields.name,
    message,
    consent,
    submittedAt: contact.createdAt,
  });

  sendGenericContactEmails(
    {
      name: fields.name,
      email: fields.email,
      message,
      portfolioType,
    },
    ownerEmail,
    ownerName
  ).catch(() => {
    console.error("booking_request_email_failed");
  });

  return {
    success: true,
    message: rules.confirmationText || "Booking request received",
  };
}

module.exports = {
  BookingRequestError,
  submitBookingRequest,
  findPublishedBookingSection,
  bookingRulesFromSection,
  loadPublicPublishedPortfolio,
};