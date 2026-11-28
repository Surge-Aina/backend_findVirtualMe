/**
 * Creates or updates a comped customer account (no Stripe billing).
 *
 * Usage:
 *   MONGODB_URI=... EMAIL=... NAME=... USERNAME=... COMPED_PLAN=basic \
 *     node scripts/create-comped-customer.js --password-out /path/secret.txt
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
  quiet: true,
});

const crypto = require("crypto");
const fs = require("fs");
const dns = require("dns");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../src/shared/models/User");
const { hasBlockingStripeSubscription } = require("../src/shared/utils/compedStripe");

const ENV_KEYS = {
  email: "EMAIL",
  name: "NAME",
  username: "USERNAME",
  compedPlan: "COMPED_PLAN",
  mongoUri: "MONGODB_URI",
};

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    return String(process.argv[idx + 1]).trim();
  }
  return "";
}

function readConfig(key) {
  const cliFlag = {
    email: "--email",
    name: "--name",
    username: "--username",
    compedPlan: "--comped-plan",
    mongoUri: "--mongo-uri",
  };
  const fromCli = readArg(cliFlag[key]);
  if (fromCli) return fromCli;
  const envName = ENV_KEYS[key];
  if (envName && process.env[envName]) {
    return String(process.env[envName]).trim();
  }
  return "";
}

function normalizeCompedPlan(raw) {
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim().toLowerCase();
  if (!value || value === "null") return null;
  if (value === "basic" || value === "pro") return value;
  throw new Error("COMPED_PLAN must be basic, pro, or null");
}

function generatePassword() {
  return crypto.randomBytes(24).toString("base64url");
}

async function connectMongo(uri) {
  if (process.env.DNS_SERVERS) {
    const servers = process.env.DNS_SERVERS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (servers.length) dns.setServers(servers);
  }
  await mongoose.connect(uri);
}

async function main() {
  const email = readConfig("email").toLowerCase();
  const name = readConfig("name");
  const username = readConfig("username");
  const compedPlan = normalizeCompedPlan(readConfig("compedPlan"));
  const mongoUri = readConfig("mongoUri");
  const passwordOut = readArg("--password-out");

  if (!email) throw new Error("EMAIL is required");
  if (!name) throw new Error("NAME is required");
  if (!username) throw new Error("USERNAME is required");
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  if (!passwordOut) throw new Error("--password-out is required");

  await connectMongo(mongoUri);

  let user = await User.findOne({ email });
  if (user) {
    if (!user.comped && (await hasBlockingStripeSubscription(user))) {
      throw new Error("HAS_ACTIVE_SUBSCRIPTION");
    }
    user.set({
      name,
      displayName: name,
      username,
      role: "customer",
      isDemo: false,
      comped: true,
      compedPlan,
      isActive: true,
    });
    user.stripeSubscriptionId = undefined;
    await user.save();
  } else {
    const password = generatePassword();
    const hashed = await bcrypt.hash(password, 10);
    fs.writeFileSync(passwordOut, `${password}\n`, { mode: 0o600 });
    user = await User.create({
      email,
      name,
      displayName: name,
      username,
      password: hashed,
      authProvider: "local",
      role: "customer",
      isDemo: false,
      comped: true,
      compedPlan,
      isActive: true,
    });
  }

  console.log(JSON.stringify({ userId: String(user._id) }));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || String(err));
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});