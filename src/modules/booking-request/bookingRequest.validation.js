const { BookingRequestError } = require("./bookingRequest.errors");

const LIMITS = Object.freeze({
  name: 120,
  email: 254,
  phone: 32,
  message: 2000,
  service: 80,
});

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function capString(value, max, field, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new BookingRequestError(`${field} is required`, {
        code: "validation_error",
        details: { field },
      });
    }
    return "";
  }
  if (typeof value !== "string") {
    throw new BookingRequestError(`${field} must be a string`, {
      code: "validation_error",
      details: { field },
    });
  }
  if (value.length > max) {
    throw new BookingRequestError(`${field} exceeds maximum length`, {
      code: "validation_error",
      details: { field, max },
    });
  }
  return value;
}

function validatePublicBookingFields(body) {
  const name = capString(body.name, LIMITS.name, "name", { required: true });
  const emailRaw = capString(body.email, LIMITS.email, "email", { required: true });
  if (!EMAIL_FORMAT.test(emailRaw)) {
    throw new BookingRequestError("email must be a valid address", {
      code: "validation_error",
      details: { field: "email" },
    });
  }
  const phone =
    body.phone === undefined || body.phone === null || body.phone === ""
      ? ""
      : capString(body.phone, LIMITS.phone, "phone");
  const message =
    body.message === undefined || body.message === null || body.message === ""
      ? ""
      : capString(body.message, LIMITS.message, "message");
  const service =
    body.service === undefined || body.service === null || body.service === ""
      ? ""
      : capString(body.service, LIMITS.service, "service");

  return { name, email: emailRaw, phone, message, service };
}

module.exports = {
  LIMITS,
  validatePublicBookingFields,
};