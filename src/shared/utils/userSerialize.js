/**
 * User response serializer.
 * Password hashes, reset tokens, and Stripe identifiers are never returned.
 * Email is included only when the caller is allowed to see that user's address
 * (the account itself, or an admin).
 */

const ALWAYS_HIDDEN = [
  "password",
  "passwordHash",
  "resetPasswordToken",
  "resetPasswordExpires",
  "resetCode",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "googleId",
  "__v",
];

function toPlain(userDoc) {
  if (typeof userDoc.toObject === "function") return userDoc.toObject();
  return { ...userDoc };
}

function stripSecrets(plain) {
  const u = { ...plain };
  for (const key of ALWAYS_HIDDEN) delete u[key];
  if (Array.isArray(u.domains)) {
    u.domains = u.domains.map((domain) => {
      if (!domain || typeof domain !== "object") return domain;
      const copy = { ...domain };
      delete copy.paymentIntentId;
      return copy;
    });
  }
  return { ...u, appTheme: u.appTheme === "dark" ? "dark" : "light" };
}

/**
 * @param {object|null|undefined} userDoc
 * @param {{ includeEmail?: boolean }} [options]
 */
function serializeUser(userDoc, { includeEmail = false } = {}) {
  if (userDoc == null) return userDoc;
  const u = stripSecrets(toPlain(userDoc));
  if (!includeEmail) delete u.email;
  return u;
}

/** Fields a public portfolio page may show for its owner. No email or secrets. */
function serializePublicUser(userDoc) {
  if (userDoc == null) return userDoc;
  const u = toPlain(userDoc);
  const id = u._id || u.id || null;
  return {
    id,
    _id: id,
    displayName: u.displayName || "",
    username: u.username || "",
    name: u.name || "",
    firstName: u.firstName || "",
    lastName: u.lastName || "",
  };
}

/** Self/admin view: theme normalization plus secret stripping, email kept. */
function normalizeUserAppTheme(userDoc) {
  return serializeUser(userDoc, { includeEmail: true });
}

module.exports = {
  normalizeUserAppTheme,
  serializeUser,
  serializePublicUser,
};
