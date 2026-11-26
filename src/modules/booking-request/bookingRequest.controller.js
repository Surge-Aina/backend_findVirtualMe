const { submitBookingRequest } = require("./bookingRequest.service");
const { isHoneypotTripped, silentlyAcceptSpam } = require("../contact/leadFormSpam");

exports.submitBookingRequest = async (req, res) => {
  try {
    if (isHoneypotTripped(req.body)) {
      return silentlyAcceptSpam(res);
    }

    const result = await submitBookingRequest(req.body);
    return res.status(201).json(result);
  } catch (error) {
    if (error.name === "BookingRequestError") {
      return res.status(error.status || 400).json({
        success: false,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
    console.error("booking_request_submit_failed");
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};