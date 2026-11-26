/**
 * When FEATURE_COMPONENT_BOOKING_ENABLED is exactly "true", the BookingRequest
 * Puck component is registered and booking submissions are accepted.
 */
function isFeatureComponentBookingEnabled() {
  return process.env.FEATURE_COMPONENT_BOOKING_ENABLED === "true";
}

module.exports = {
  isFeatureComponentBookingEnabled,
};