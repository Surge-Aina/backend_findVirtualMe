const express = require("express");
const nodemailer = require("nodemailer");

const { authRequired } = require("../middleware/auth.middleware");
const { EmailAccount } = require("../models/EmailAccount");
const { EmailTemplate } = require("../models/EmailTemplate");
const { listInboxMessages, getMessageByUid } = require("../utils/imapClient");

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Known SMTP providers                                              */
/* ------------------------------------------------------------------ */

const KNOWN_PROVIDERS = {
  "gmail.com": {
    provider: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
  },
  "outlook.com": {
    provider: "outlook",
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
  },
  "hotmail.com": {
    provider: "outlook",
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
  },
  "live.com": {
    provider: "outlook",
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
  },
  "office365.com": {
    provider: "office365",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
  },
  "yahoo.com": {
    provider: "yahoo",
    host: "smtp.mail.yahoo.com",
    port: 587,
    secure: false,
  },
};

/* ------------------------------------------------------------------ */
/*  Built-in system templates                                         */
/* ------------------------------------------------------------------ */

const SYSTEM_TEMPLATES = [
  {
    name: "Refund – Simple",
    subject: "Your refund for {{subject}}",
    body:
      "Hi {{name}},\n\n" +
      "We’ve processed your refund of {{amount}}.\n" +
      "If you have any questions, just reply to this email.\n\n" +
      "Best,\n" +
      "{{senderName}}",
    variables: ["name", "amount", "subject", "senderName"],
  },
  {
    name: "Refund – Detailed",
    subject: "Refund details for {{subject}}",
    body:
      "Hi {{name}},\n\n" +
      "This is to confirm your refund of {{amount}} for {{subject}}.\n" +
      "Reason:\n" +
      "{{reason}}\n\n" +
      "Timeline: {{timeline}}\n\n" +
      "Thanks for your patience.\n" +
      "{{senderName}}",
    variables: ["name", "amount", "subject", "reason", "timeline", "senderName"],
  },
  {
    name: "Generic follow-up",
    subject: "Following up on {{subject}}",
    body:
      "Hi {{name}},\n\n" +
      "I wanted to quickly follow up on {{subject}}.\n\n" +
      "{{customNote}}\n\n" +
      "Best,\n" +
      "{{senderName}}",
    variables: ["name", "subject", "customNote", "senderName"],
  },
];

async function ensureSystemTemplates() {
  const count = await EmailTemplate.countDocuments({ isSystem: true });
  if (count === 0) {
    await EmailTemplate.insertMany(
      SYSTEM_TEMPLATES.map((t) => ({
        ...t,
        isSystem: true,
        userId: null,
      }))
    );
    console.log("✅ Seeded system email templates");
  }
}

/* ------------------------------------------------------------------ */
/*  Inbox + single message (IMAP)                                     */
/* ------------------------------------------------------------------ */
/**
 * GET /api/email/inbox?accountId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
 */
router.get("/inbox", authRequired, async (req, res) => {
  try {
    const { accountId, start, end } = req.query;

    if (!accountId) {
      return res.status(400).json({ message: "accountId is required" });
    }

    const account = await EmailAccount.findOne({
      _id: accountId,
      userId: req.user.id,
    });

    if (!account) {
      return res.status(404).json({ message: "Email account not found" });
    }

    // Parse dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let endDate = end ? new Date(end) : today;
    if (Number.isNaN(endDate.getTime())) endDate = today;
    endDate.setHours(23, 59, 59, 999);

    let startDate = start ? new Date(start) : new Date(endDate);
    if (Number.isNaN(startDate.getTime())) {
      startDate = new Date(endDate);
    }

    // Default last 7 days if no explicit start
    if (!start) {
      startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    }

    // Enforce max window of 7 days
    const maxWindowMs = 7 * 24 * 60 * 60 * 1000;
    if (endDate - startDate > maxWindowMs) {
      startDate = new Date(endDate.getTime() - maxWindowMs);
    }

    const messages = await listInboxMessages(account, startDate, endDate, 50);

    res.json({
      accountId,
      startDate,
      endDate,
      messages,
    });
  } catch (err) {
    console.error("Error reading inbox:", err);
    res
      .status(500)
      .json({ message: "Failed to load inbox", error: err.message });
  }
});

/**
 * GET /api/email/message/:accountId/:uid
 */
router.get("/message/:accountId/:uid", authRequired, async (req, res) => {
  try {
    const { accountId, uid } = req.params;

    const account = await EmailAccount.findOne({
      _id: accountId,
      userId: req.user.id,
    });

    if (!account) {
      return res.status(404).json({ message: "Email account not found" });
    }

    const message = await getMessageByUid(account, uid);

    res.json(message);
  } catch (err) {
    console.error("Error loading message:", err);
    res.status(500).json({
      message: "Failed to load email message",
      error: err.message,
    });
  }
});

/* ------------------------------------------------------------------ */
/*  SMTP auto-discovery + helpers                                     */
/* ------------------------------------------------------------------ */

async function autoDiscoverSmtp(email, password) {
  const parts = String(email).split("@");
  if (parts.length !== 2) {
    throw new Error("Invalid email address.");
  }
  const domain = parts[1].toLowerCase();

  // 1. Known domains
  if (KNOWN_PROVIDERS[domain]) {
    const base = KNOWN_PROVIDERS[domain];

    const transporter = nodemailer.createTransport({
      host: base.host,
      port: base.port,
      secure: base.secure,
      auth: {
        user: email,
        pass: password,
      },
    });

    // Will throw if credentials are wrong or server rejects
    await transporter.verify();

    return {
      provider: base.provider,
      host: base.host,
      port: base.port,
      secure: base.secure,
      username: email,
    };
  }

  // 2. Custom domains: try a couple of guesses
  const candidates = [
    { host: `smtp.${domain}`, port: 587, secure: false },
    { host: `smtp.${domain}`, port: 465, secure: true },
    { host: `mail.${domain}`, port: 587, secure: false },
    { host: `mail.${domain}`, port: 465, secure: true },
  ];

  for (const c of candidates) {
    const transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: {
        user: email,
        pass: password,
      },
    });

    try {
      await transporter.verify();
      console.log(
        `✅ SMTP discovery success for ${email} via ${c.host}:${c.port}`
      );
      return {
        provider: "custom",
        host: c.host,
        port: c.port,
        secure: c.secure,
        username: email,
      };
    } catch (err) {
      console.log(
        `❌ SMTP discovery failed for ${c.host}:${c.port} – ${err.message}`
      );
    }
  }

  throw new Error(
    "Could not automatically find SMTP settings for this email address."
  );
}

/**
 * Turn low-level SMTP errors into user-friendly guidance.
 */
function buildFriendlyEmailError(email, originalMessage) {
  const parts = String(email).split("@");
  const domain = (parts[1] || "").toLowerCase();

  let suggestions =
    "Things to check:\n" +
    "- Your email address is correct.\n" +
    "- You are using the correct password or app-specific password.\n" +
    "- If your account has 2-factor authentication (2FA), you MUST use an app password (not your normal login password).\n" +
    "- For company email, confirm with IT that SMTP is enabled and you have the right credentials.";

  if (domain === "gmail.com") {
    suggestions =
      "Gmail rejected the login. Gmail requires an *app password* instead of your normal password for external apps.\n" +
      "Steps:\n" +
      "1. Open your Google Account → Security.\n" +
      "2. Turn on 2-Step Verification (if it is not already on).\n" +
      '3. Go to \"App passwords\" and create a new app password for Mail (for example, name it \"EmailMVP\").\n' +
      "4. Copy the 16-character app password and paste it in this app instead of your regular Google password.\n" +
      "Help: https://support.google.com/mail/?p=InvalidSecondFactor";
  } else if (
    ["outlook.com", "hotmail.com", "live.com", "office365.com"].includes(
      domain
    )
  ) {
    suggestions =
      "Outlook/Office365 rejected the login. Usually you must use an app password or enable SMTP AUTH.\n" +
      "Steps:\n" +
      "1. Check that SMTP/SMTP AUTH is enabled for your account.\n" +
      "2. If you use multi-factor authentication, create an app-specific password.\n" +
      "3. Use that app password here instead of your normal account password.";
  }

  return `${originalMessage}\n\n${suggestions}`;
}

/* ------------------------------------------------------------------ */
/*  Email accounts CRUD                                               */
/* ------------------------------------------------------------------ */
/**
 * POST /api/email-accounts
 * Body: { email, password, name?, fromName? }
 */
router.post("/email-accounts", authRequired, async (req, res) => {
  try {
    const { email, password, name, fromName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required.",
      });
    }

    let smtpConfig;
    try {
      smtpConfig = await autoDiscoverSmtp(email, password);
    } catch (err) {
      const friendly = buildFriendlyEmailError(
        email,
        err.message || "Login to your email server failed."
      );
      return res.status(400).json({ message: friendly });
    }

    const account = await EmailAccount.create({
      userId: req.user.id,
      provider: smtpConfig.provider,
      name: name || email,
      fromName: fromName || "",
      fromEmail: email,
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      username: smtpConfig.username,
      password, // ⚠️ plain text for MVP only
    });

    res.status(201).json({
      message: "Email account saved.",
      account: {
        id: account._id,
        name: account.name,
        fromName: account.fromName,
        fromEmail: account.fromEmail,
        host: account.host,
        port: account.port,
        secure: account.secure,
        provider: account.provider,
      },
    });
  } catch (err) {
    console.error("Create email account error:", err);
    const friendly = buildFriendlyEmailError(
      req.body?.email || "",
      err.message || "Server error creating email account."
    );
    res.status(500).json({ message: friendly });
  }
});

/**
 * GET /api/email-accounts
 */
router.get("/email-accounts", authRequired, async (req, res) => {
  try {
    const accounts = await EmailAccount.find({ userId: req.user.id })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      accounts: accounts.map((a) => ({
        id: a._id,
        name: a.name,
        fromName: a.fromName,
        fromEmail: a.fromEmail,
        host: a.host,
        port: a.port,
        secure: a.secure,
        provider: a.provider,
      })),
    });
  } catch (err) {
    console.error("List email accounts error:", err);
    res.status(500).json({ message: "Server error listing email accounts." });
  }
});

/* ------------------------------------------------------------------ */
/*  Templates                                                         */
/* ------------------------------------------------------------------ */
/**
 * GET /api/email/templates
 */
router.get("/templates", authRequired, async (req, res) => {
  try {
    await ensureSystemTemplates();

    const userId = req.user.id;

    const templates = await EmailTemplate.find({
      $or: [{ isSystem: true }, { userId }],
    }).sort({ isSystem: -1, createdAt: -1 });

    res.json({
      templates: templates.map((t) => ({
        id: t._id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        variables: t.variables || [],
        isSystem: t.isSystem,
      })),
    });
  } catch (err) {
    console.error("List email templates error:", err);
    res
      .status(500)
      .json({ message: "Server error listing email templates." });
  }
});

/**
 * POST /api/email/templates
 * Body: { name, subject, body, variables? }
 */
router.post("/templates", authRequired, async (req, res) => {
  try {
    const { name, subject, body, variables } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({
        message: "name, subject, and body are required.",
      });
    }

    // if variables not provided, infer from {{var}} in body+subject
    let vars = Array.isArray(variables) ? variables : [];

    if (vars.length === 0) {
      const text = `${subject}\n${body}`;
      const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
      const found = new Set();
      let match;
      while ((match = regex.exec(text))) {
        found.add(match[1]);
      }
      vars = Array.from(found);
    }

    const tpl = await EmailTemplate.create({
      userId: req.user.id,
      name,
      subject,
      body,
      variables: vars,
      isSystem: false,
    });

    res.status(201).json({
      message: "Template created.",
      template: {
        id: tpl._id,
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
        variables: tpl.variables,
        isSystem: tpl.isSystem,
      },
    });
  } catch (err) {
    console.error("Create template error:", err);
    res.status(500).json({ message: "Server error creating template." });
  }
});

/* ------------------------------------------------------------------ */
/*  Send single email                                                 */
/* ------------------------------------------------------------------ */
/**
 * POST /api/email/send
 * Body: { accountId, to, subject, body }
 */
router.post("/send", authRequired, async (req, res) => {
  let account = null;

  try {
    const { accountId, to, subject, body } = req.body;

    if (!accountId || !to || !subject || !body) {
      return res.status(400).json({
        message: "accountId, to, subject, and body are required.",
      });
    }

    account = await EmailAccount.findOne({
      _id: accountId,
      userId: req.user.id,
    });

    if (!account) {
      return res.status(404).json({ message: "Email account not found." });
    }

    const transporter = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: {
        user: account.username,
        pass: account.password,
      },
    });

    const fromAddress = account.fromName
      ? `"${account.fromName}" <${account.fromEmail}>`
      : account.fromEmail;

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: body,
    });

    res.json({ message: "Email sent successfully." });
  } catch (err) {
    console.error("Send email error:", err);
    const friendly = buildFriendlyEmailError(
      account?.fromEmail || "",
      err.message || "Server error sending email."
    );
    res.status(500).json({ message: friendly });
  }
});

/* ------------------------------------------------------------------ */
/*  Bulk reply send                                                   */
/* ------------------------------------------------------------------ */
/**
 * POST /api/email/reply-bulk
 * Body: { replies: [ { accountId, to, subject, body, continueThread?, originalSubject? } ] }
 */
router.post("/reply-bulk", authRequired, async (req, res) => {
  let accountsMap = new Map();

  try {
    const { replies } = req.body;

    if (!Array.isArray(replies) || replies.length === 0) {
      return res.status(400).json({
        message: "replies array is required and cannot be empty.",
      });
    }
    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const reply of replies) {
      if (!reply.to || !emailRegex.test(reply.to.trim())) {
        return res.status(400).json({
          message: `Invalid email address: ${reply.to}`,
        });
      }
    }
    // unique accounts for this user
    const accountIds = Array.from(
      new Set(replies.map((r) => String(r.accountId)))
    );

    const accounts = await EmailAccount.find({
      _id: { $in: accountIds },
      userId: req.user.id,
    });

    accountsMap = new Map(accounts.map((a) => [String(a._id), a]));

    const results = [];

    for (const r of replies) {
      const account = accountsMap.get(String(r.accountId));
      if (!account) {
        results.push({
          to: r.to,
          subject: r.subject,
          status: "error",
          error: "Email account not found or not owned by user.",
        });
        continue;
      }

      try {
        const transporter = nodemailer.createTransport({
          host: account.host,
          port: account.port,
          secure: account.secure,
          auth: {
            user: account.username,
            pass: account.password,
          },
        });

        const fromAddress = account.fromName
          ? `"${account.fromName}" <${account.fromEmail}>`
          : account.fromEmail;

        const mailOptions = {
          from: fromAddress,
          to: r.to,
          subject: r.subject,
          text: r.body,
        };

        // For real threads we'd add In-Reply-To / References; MVP relies on subject+participants.
        await transporter.sendMail(mailOptions);

        results.push({
          to: r.to,
          subject: r.subject,
          status: "sent",
        });
      } catch (err) {
        console.error("Bulk reply send error:", err);
        results.push({
          to: r.to,
          subject: r.subject,
          status: "error",
          error: err.message,
        });
      }
    }

    res.json({
      message: "Bulk replies processed.",
      results,
    });
  } catch (err) {
    console.error("Reply bulk error:", err);
    res
      .status(500)
      .json({ message: "Server error during bulk reply.", error: err.message });
  }
});

module.exports = router;