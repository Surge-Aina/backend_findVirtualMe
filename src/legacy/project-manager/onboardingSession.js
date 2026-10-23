/** UUID v4 only. Time-based UUID versions are guessable enough to steal a draft. */
const ONBOARDING_SESSION_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function onboardingSessionId(value) {
  const sessionId = String(value || "").trim().toLowerCase();
  return ONBOARDING_SESSION_RE.test(sessionId) ? sessionId : "";
}

module.exports = {
  onboardingSessionId,
};
