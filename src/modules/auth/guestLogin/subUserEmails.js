const nodemailer = require("nodemailer");

/**
 * Transactional emails for the portfolio sub-user (guestUser) feature.
 * Reuses the same SMTP env vars as `shared/services/emailService.js` and
 * silently no-ops if SMTP is not configured (so unit tests / dev without SMTP
 * are not affected).
 */
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

function shellHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:0; color:#333; }
  .container { max-width:600px; margin:40px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.08); }
  .header { background:#3B82F6; color:#fff; text-align:center; padding:20px; }
  .content { padding:30px; }
  .info-box { background:#f9fafb; border-left:4px solid #3B82F6; padding:15px; margin:15px 0; border-radius:4px; }
  .footer { font-size:13px; color:#777; margin-top:25px; text-align:center; }
</style></head><body>
  <div class="container">
    <div class="header"><h2>${title}</h2></div>
    <div class="content">${bodyHtml}<div class="footer">— FindVirtualMe</div></div>
  </div>
</body></html>`;
}

function formatScheduledFor(date) {
  if (!date) return "Not specified";
  try {
    return new Date(date).toLocaleString();
  } catch (_err) {
    return String(date);
  }
}

async function safeSend(mailOptions) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[subUserEmails] SMTP not configured; skipping email", mailOptions.subject);
    return { skipped: true };
  }
  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (err) {
    console.error("[subUserEmails] sendMail failed:", err?.message || err);
    return { error: err?.message || String(err) };
  }
}

async function sendSubUserWelcomeEmail({ subUserEmail, subUserName, portfolioTitle }) {
  const body = `
    <p>Hi <strong>${subUserName || "there"}</strong>,</p>
    <p>Your account for <strong>${portfolioTitle || "this portfolio"}</strong> is ready.</p>
    <div class="info-box">
      You can now sign in to view your past activity, request services, and manage
      your profile.
    </div>
    <p>Welcome aboard!</p>
  `;
  return safeSend({
    from: `"${portfolioTitle || "FindVirtualMe"}" <${process.env.SMTP_USER}>`,
    to: subUserEmail,
    subject: `Welcome to ${portfolioTitle || "your portfolio account"}`,
    html: shellHtml("Welcome", body),
  });
}

async function sendOwnerActivityRequestEmail({
  ownerEmail,
  ownerName,
  portfolioTitle,
  subUserName,
  subUserEmail,
  activity,
}) {
  const serviceLine = activity?.serviceLabel
    ? `<p><strong>Service:</strong> ${activity.serviceLabel}</p>`
    : "";
  const body = `
    <p>Hi <strong>${ownerName || "there"}</strong>,</p>
    <p>You have a new request from <strong>${subUserName}</strong> on
       <strong>${portfolioTitle}</strong>.</p>
    <div class="info-box">
      ${serviceLine}
      <p><strong>Requested for:</strong> ${formatScheduledFor(activity?.scheduledFor)}</p>
      <p><strong>Type:</strong> ${activity?.type || "visit"}</p>
      ${activity?.notes ? `<p><strong>Notes:</strong> ${activity.notes}</p>` : ""}
      <p><strong>Customer email:</strong> <a href="mailto:${subUserEmail}">${subUserEmail}</a></p>
    </div>
    <p>Sign in to your portfolio admin to approve, reschedule, or decline this request.</p>
  `;
  return safeSend({
    from: `"${portfolioTitle || "FindVirtualMe"}" <${process.env.SMTP_USER}>`,
    to: ownerEmail,
    replyTo: subUserEmail || undefined,
    subject: `New request from ${subUserName} - ${portfolioTitle}`,
    html: shellHtml("New activity request", body),
  });
}

const STATUS_COPY = {
  confirmed: "approved",
  declined: "declined",
  cancelled: "cancelled",
  completed: "marked as completed",
  pending: "set back to pending",
};

async function sendSubUserActivityDecisionEmail({
  subUserEmail,
  subUserName,
  portfolioTitle,
  activity,
  previousStatus,
}) {
  const verb = STATUS_COPY[activity?.status] || `updated to ${activity?.status}`;
  const body = `
    <p>Hi <strong>${subUserName || "there"}</strong>,</p>
    <p>Your request on <strong>${portfolioTitle}</strong> has been <strong>${verb}</strong>.</p>
    <div class="info-box">
      ${activity?.serviceLabel ? `<p><strong>Service:</strong> ${activity.serviceLabel}</p>` : ""}
      <p><strong>Scheduled for:</strong> ${formatScheduledFor(activity?.scheduledFor)}</p>
      <p><strong>Status:</strong> ${activity?.status} ${
        previousStatus ? `(was ${previousStatus})` : ""
      }</p>
      ${activity?.notes ? `<p><strong>Your note:</strong> ${activity.notes}</p>` : ""}
    </div>
    <p>Sign in to your account for details.</p>
  `;
  return safeSend({
    from: `"${portfolioTitle || "FindVirtualMe"}" <${process.env.SMTP_USER}>`,
    to: subUserEmail,
    subject: `Update on your request - ${portfolioTitle}`,
    html: shellHtml("Request update", body),
  });
}

module.exports = {
  sendSubUserWelcomeEmail,
  sendOwnerActivityRequestEmail,
  sendSubUserActivityDecisionEmail,
};
