const mongoose = require("mongoose");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function invalid(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function parseLimit(value) {
  if (value === undefined || value === "") return DEFAULT_LIMIT;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw invalid("invalid_limit", "limit must be an integer from 1 to 100");
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > MAX_LIMIT) {
    throw invalid("invalid_limit", "limit must be an integer from 1 to 100");
  }
  return parsed;
}

function encodeCursor(id) {
  return Buffer.from(String(id), "utf8").toString("base64url");
}

function decodeCursor(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 200) {
    throw invalid("invalid_cursor", "cursor is invalid");
  }

  let decoded = "";
  try {
    decoded = Buffer.from(value, "base64url").toString("utf8");
  } catch (_err) {
    throw invalid("invalid_cursor", "cursor is invalid");
  }

  if (!mongoose.isValidObjectId(decoded)) {
    throw invalid("invalid_cursor", "cursor is invalid");
  }
  return decoded;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parseLimit,
  encodeCursor,
  decodeCursor,
};
