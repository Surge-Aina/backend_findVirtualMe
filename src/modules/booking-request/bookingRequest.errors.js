class BookingRequestError extends Error {
  constructor(message, { status = 400, code = "validation_error", details } = {}) {
    super(message);
    this.name = "BookingRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  BookingRequestError,
};