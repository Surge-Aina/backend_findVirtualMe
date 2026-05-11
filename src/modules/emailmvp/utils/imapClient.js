// src/utils/imapClient.js
// IMAP helper for listing inbox messages and loading a single message by UID.
//
// Requires:
//   npm install imapflow mailparser
//
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

/**
 * Map SMTP provider / domain to IMAP host/port.
 * We only handle the common ones for MVP.
 */
function getImapConfigFromAccount(account) {
  const email = account.fromEmail || account.username;
  const parts = String(email).split("@");
  const domain = (parts[1] || "").toLowerCase();

  let host = "imap.gmail.com";
  let port = 993;
  let secure = true;

  if (account.provider === "gmail" || domain === "gmail.com") {
    host = "imap.gmail.com";
    port = 993;
    secure = true;
  } else if (
    account.provider === "outlook" ||
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "office365.com"
  ) {
    host = "outlook.office365.com";
    port = 993;
    secure = true;
  } else if (account.provider === "yahoo" || domain === "yahoo.com") {
    host = "imap.mail.yahoo.com";
    port = 993;
    secure = true;
  } else {
    // Fallback: try imap.<domain>
    host = `imap.${domain}`;
    port = 993;
    secure = true;
  }

  return {
    host,
    port,
    secure,
    auth: {
      user: account.username,
      pass: account.password,
    },
  };
}

/**
 * Internal helper: connect to IMAP for an account.
 */
async function connectImap(account) {
  const config = getImapConfigFromAccount(account);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await client.connect();
  return client;
}

/**
 * List inbox messages for a date window.
 *
 * @param {EmailAccount} account
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} limit
 * @returns {Promise<Array>}
 */
 async function listInboxMessages(
  account,
  startDate,
  endDate,
  limit = 50
) {
  const client = await connectImap(account);

  try {
    const lock = await client.getMailboxLock("INBOX");
    const messages = [];

    try {
      // Search by date window if possible; if not, just ALL and filter.
      const searchCriteria = {};
      if (startDate) searchCriteria.since = startDate;
      if (endDate) {
        // IMAP BEFORE is non-inclusive, so add 1 day
        const dayAfter = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
        searchCriteria.before = dayAfter;
      }

      const uids = await client.search(
        Object.keys(searchCriteria).length ? searchCriteria : { all: true }
      );

      if (!uids || uids.length === 0) {
        return [];
      }

      // Take last N (most recent)
      const recentUids = uids.slice(-limit).reverse(); // newest first

      for await (const msg of client.fetch(recentUids, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        bodyStructure: true,
      })) {
        
        const envelope = msg.envelope || {};
       const from = (envelope.from || []).map((f) => {
    const name = f.name || "";
    const mailbox = f.mailbox || "";
    const host = f.host || "";
    
    // Only create address if we have both parts
    let addr = "";
    if (mailbox && host) {
        addr = `${mailbox}@${host}`;
    } else if (mailbox) {
        addr = mailbox;
    } else if (f.address) {
        // Fallback: some IMAP servers put full email in .address
        addr = f.address;
    }
    
    // Skip if no valid email found
    if (!addr || addr === "@") {
        return name || "Unknown";
    }
    
    return name ? `${name} <${addr}>` : addr;
});

        const seen = msg.flags ? msg.flags.has("\\Seen") : false;

        messages.push({
          uid: msg.uid,
          subject: envelope.subject || "",
          from,
          date: msg.internalDate || envelope.date || null,
          seen,
        });
      }

      return messages;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

/**
 * Load a full message body by UID.
 *
 * @param {EmailAccount} account
 * @param {string|number} uid
 * @returns {Promise<Object>}
 */
 async function getMessageByUid(account, uid) {
  const client = await connectImap(account);

  try {
    const lock = await client.getMailboxLock("INBOX");

    try {
      const u = Number(uid);
      const fetchResult = await client.fetchOne(u, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: true,
      });

      if (!fetchResult) {
        throw new Error("Message not found");
      }

      const parsed = await simpleParser(fetchResult.source);

      const envelope = fetchResult.envelope || {};
    const from = (envelope.from || []).map((f) => {
    const name = f.name || "";
    const mailbox = f.mailbox || "";
    const host = f.host || "";
    
    // Only create address if we have both parts
    let addr = "";
    if (mailbox && host) {
        addr = `${mailbox}@${host}`;
    } else if (mailbox) {
        addr = mailbox;
    } else if (f.address) {
        // Fallback: some IMAP servers put full email in .address
        addr = f.address;
    }
    
    // Skip if no valid email found
    if (!addr || addr === "@") {
        return name || "Unknown";
    }
    
    return name ? `${name} <${addr}>` : addr;
});

      const to = (envelope.to || []).map((f) => {
    const name = f.name || "";
    const mailbox = f.mailbox || "";
    const host = f.host || "";
    
    // Only create address if we have both parts
    let addr = "";
    if (mailbox && host) {
        addr = `${mailbox}@${host}`;
    } else if (mailbox) {
        addr = mailbox;
    } else if (f.address) {
        // Fallback: some IMAP servers put full email in .address
        addr = f.address;
    }
    
    // Skip if no valid email found
    if (!addr || addr === "@") {
        return name || "Unknown";
    }
    
    return name ? `${name} <${addr}>` : addr;
});

      return {
        uid: fetchResult.uid,
        subject: envelope.subject || "",
        from,
        to,
        date: fetchResult.internalDate || envelope.date || null,
        seen: fetchResult.flags ? fetchResult.flags.has("\\Seen") : false,
        text: parsed.text || "",
        html: parsed.html || "",
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
module.exports = { listInboxMessages, getMessageByUid };