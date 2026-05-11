const express = require("express");
const { google } = require("googleapis");
const { authRequired } = require("../middleware/auth.middleware");
const { createOAuthClient, GMAIL_SCOPES } = require("../services/googleClient");
const { GoogleAccount } = require("../models/GoogleAccount");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";


/**
 * GET /api/oauth/google/start
 * Must be called by a logged-in user (JWT).
 * Returns { url } – where the frontend should redirect the browser.
 */
router.get("/google/start", authRequired, async (req, res) => {
  const client = createOAuthClient();
  if (!client) {
    return res
      .status(500)
      .json({ message: "Google OAuth is not configured on the server." });
  }

  // state = userId. For real prod, add a CSRF token; for MVP this is fine.
  const state = String(req.user.id);

  const authUrl = client.generateAuthUrl({
    access_type: "offline", // get refresh_token
    prompt: "consent", // always ask consent so we get refresh_token once
    scope: GMAIL_SCOPES,
    state,
  });

  res.json({ url: authUrl });
});

/**
 * GET /api/oauth/google/callback
 * Google → Okta / Duo / etc → Google → this endpoint.
 * Exchanges code for tokens, stores them, and does a small Gmail API test.
 * Then redirects back to FRONTEND_URL with query parameters.
 */
router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    const redirectUrl = `${FRONTEND_URL}/oauth/google-done?error=${encodeURIComponent(
      error
    )}`;
    return res.redirect(redirectUrl);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state.");
  }

  const client = createOAuthClient();
  if (!client) {
    return res.status(500).send("Google OAuth not configured.");
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get Google profile – we mainly need the email
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const meRes = await oauth2.userinfo.get();
    const email = meRes.data.email;

    const userId = state; // we put req.user.id into state earlier

    const data = {
      userId,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };

    await GoogleAccount.findOneAndUpdate(
      { userId, email },
      data,
      { upsert: true, new: true }
    );

    // QUICK TEST: try to list Gmail labels.
    // If this fails with "not allowed", then admin is blocking the scopes.
    const gmail = google.gmail({ version: "v1", auth: client });

    let success = "true";
    try {
      await gmail.users.labels.list({ userId: "me" });
    } catch (err) {
      console.error("Gmail test failed:", err.message);
      success = "false";
    }

    const redirectUrl = `${FRONTEND_URL}/oauth/google-done?success=${encodeURIComponent(
      success
    )}&email=${encodeURIComponent(email)}`;

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Google callback error:", err);
    const redirectUrl = `${FRONTEND_URL}/oauth/google-done?error=${encodeURIComponent(
      err.message || "OAuth error"
    )}`;
    return res.redirect(redirectUrl);
  }
});

module.exports = router;
