const Portfolio = require("../portfolios/models/Portfolio");
const ContactMeForm = require("../contact/contactMeForm.model");
const portfolioService = require("../portfolios/portfolio.service");
const User = require("../../shared/models/User");
const { notifyLeadCaptured, notifyFormSubmitted } = require("../public-api/lifecycleEvents");
const { consentContactFromBody } = require("../public-api/leadConsent");
const { sendGenericContactEmails } = require("../../shared/services/emailService");
const { isFeatureComponentBookingEnabled } = require("../../shared/config/featureComponentBooking");
const { sectionDataToPuckProps } = require("../portfolios/models/featureComponentAdapters");
const { validateRequestedWindow } = require("./bookingWindow");

class BookingRequestError extends Error {
  constructor(message, { status = 400, code = "validation_error", details } = {}) {
    super(message);
    this.name = "BookingRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function findPublishedBookingSection(portfolio, sectionId) {
  const sections = portfolio.sections || [];
  if (sectionId) {
    const match = sections.find(
      (s) => String(s._id) === String(sectionId) && s.type === "bookingRequest"
    );
    if (match) return match;
  }
  return sections.find((s) => s.type === "bookingRequest" && s.visible !== false) || null;
}

function bookingRulesFromSection(section) {
  const data = section?.data && typeof section.data === "object" ? section.data : {};
  const puck = sectionDataToPuckProps("BookingRequest", data, "");
  return {
    minNoticeHours: puck.minNoticeHours ?? data.minNoticeHours ?? 24,
    daysAheadMax: puck.daysAheadMax ?? data.daysAheadMax ?? 30,
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
      details: { field: "service", allowed },
    });
  }
  return trimmed;
}

function formatBookingMessage({ service, requestedStart, requestedEnd, timezone }) {
  return [
    "Booking request (not a confirmed appointment).",
    `Service: ${service}`,
    `Requested window (${timezone}): ${requestedStart} – ${requestedEnd}`,
  ].join("\n");
}

async function submitBookingRequest(body) {
  if (!isFeatureComponentBookingEnabled()) {
    throw new BookingRequestError("Booking requests are not enabled", {
      status: 404,
      code: "FEATURE_COMPONENT_BOOKING_DISABLED",
    });
  }

  const {
    name,
    email,
    phone,
    portfolioId,
    sectionId,
    service,
    requestedStart,
    requestedEnd,
    ownerEmail,
    ownerName,
    portfolioType,
  } = body;

  if (!name || !email || !portfolioId || !requestedStart || !requestedEnd) {
    throw new BookingRequestError(
      "name, email, portfolioId, requestedStart, and requestedEnd are required",
      { code: "validation_error" }
    );
  }

  const portfolio = await portfolioService.getPortfolio(portfolioId);
  if (!portfolio) {
    throw new BookingRequestError("Site not found", { status: 404, code: "not_found" });
  }

  const section = findPublishedBookingSection(portfolio, sectionId);
  if (!section) {
    throw new BookingRequestError("Booking section not found on published site", {
      status: 404,
      code: "not_found",
      details: { field: "sectionId" },
    });
  }

  const rules = bookingRulesFromSection(section);
  try {
    validateRequestedWindow({
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

  const serviceLabel = validateServiceChoice(service, rules.services);

  let resolvedOwnerEmail = ownerEmail;
  let resolvedOwnerName = ownerName;
  if (!resolvedOwnerEmail || !resolvedOwnerName) {
    const owner = await User.findById(portfolio.owner).select("email name username").lean();
    resolvedOwnerEmail = resolvedOwnerEmail || owner?.email;
    resolvedOwnerName = resolvedOwnerName || owner?.name || owner?.username;
  }
  if (!resolvedOwnerEmail || !resolvedOwnerName) {
    throw new BookingRequestError("Owner contact could not be resolved", {
      code: "validation_error",
    });
  }

  const consentContact = consentContactFromBody(body);
  const message = formatBookingMessage({
    service: serviceLabel,
    requestedStart,
    requestedEnd,
    timezone: rules.timezone,
  });

  const contact = await ContactMeForm.create({
    portfolioId,
    portfolioType,
    ownerEmail: resolvedOwnerEmail,
    ownerName: resolvedOwnerName,
    name,
    email,
    phone: typeof phone === "string" ? phone.trim() : undefined,
    message,
    leadType: "booking",
    bookingService: serviceLabel,
    bookingRequestedStart: new Date(requestedStart),
    bookingRequestedEnd: new Date(requestedEnd),
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
    email,
    name,
    phone: contact.phone,
    consent,
    createdAt: contact.createdAt,
  });
  notifyFormSubmitted({
    siteId: portfolioId,
    leadId,
    form: "booking",
    email,
    name,
    phone: contact.phone,
    message,
    consent,
    submittedAt: contact.createdAt,
  });

  sendGenericContactEmails(
    {
      name,
      email,
      message,
      portfolioType,
      phone: contact.phone,
    },
    resolvedOwnerEmail,
    resolvedOwnerName
  ).catch(() => {
    console.error("booking_request_email_failed");
  });

  return {
    success: true,
    message: rules.confirmationText || "Booking request received",
    leadId,
  };
}

module.exports = {
  BookingRequestError,
  submitBookingRequest,
  findPublishedBookingSection,
  bookingRulesFromSection,
};