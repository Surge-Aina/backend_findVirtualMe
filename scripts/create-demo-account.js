/**
 * Creates or updates the demo customer account and a sample public handyman portfolio.
 *
 * Usage:
 *   MONGODB_URI=... DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/create-demo-account.js
 *
 * On Railway:
 *   railway run node scripts/create-demo-account.js
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const bcrypt = require("bcrypt");
const dns = require("dns");
const mongoose = require("mongoose");

const User = require("../src/shared/models/User");
const portfolioService = require("../src/modules/portfolios/portfolio.service");
const { getDefaultSections } = require("../src/modules/portfolios/models/templateDefaults");
const { updatePortfolioArray } = require("../src/modules/portfolios/userPortfoliosArray/userPortfoliosArray.service");
const { platformHost } = require("../src/modules/public-api/siteView");

const TEMPLATE = "handyman";
const DEMO_SLUG = "northside-fix-it-demo";
const BUSINESS_NAME = "Northside Fix-It Co.";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required`);
  }
  return String(value).trim();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildDemoSections() {
  const sections = deepClone(getDefaultSections(TEMPLATE));

  const hero = sections.find((s) => s.type === "hero");
  if (hero?.data) {
    hero.data.title = BUSINESS_NAME;
    hero.data.subtitle =
      "Fictional demo account — licensed-style home repair and maintenance in Metroville.";
    hero.data.phoneNumber = "(555) 010-2048";
    hero.data.ctaText = "Request a quote";
  }

  const contact = sections.find((s) => s.type === "contact");
  if (contact?.data) {
    contact.data.email = "hello@northside-fix-it.example.test";
    contact.data.phone = "(555) 010-2048";
    contact.data.title = "Contact Northside Fix-It Co.";
    contact.data.subtitle =
      "This is sample content for the FindVirtualMe demo customer.";
  }

  return sections;
}

function usernameFromEmail(email) {
  const local = email.split("@")[0] || "demo-customer";
  const safe = local.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  return safe || "demo-customer";
}

function publicSiteLine(slug) {
  const host = platformHost();
  const trimmed = String(slug || "").trim().toLowerCase();
  if (!trimmed) return `https://${host}`;
  return `https://${trimmed}.${host}`;
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

async function upsertDemoUser(email, password) {
  const hashed = await bcrypt.hash(password, 10);
  const base = {
    email,
    name: "Northside Demo Customer",
    displayName: "Demo Customer",
    username: usernameFromEmail(email),
    password: hashed,
    authProvider: "local",
    role: "customer",
    isDemo: true,
    isActive: true,
  };

  let user = await User.findOne({ email });
  if (user) {
    user.set(base);
    await user.save();
  } else {
    user = await User.create(base);
  }
  return user;
}

async function upsertDemoPortfolio(ownerId) {
  const existing = await portfolioService.getPortfolioBySlug(DEMO_SLUG);
  const sections = buildDemoSections();

  if (existing && String(existing.owner) === String(ownerId)) {
    await portfolioService.updatePortfolio(existing._id, {
      title: BUSINESS_NAME,
      slug: DEMO_SLUG,
      visibility: "public",
      sections,
    });
    const updated = await portfolioService.getPortfolio(existing._id);
    return updated;
  }

  if (existing) {
    throw new Error(
      `Slug ${DEMO_SLUG} is already used by another owner; pick a different DEMO_SLUG in the script.`,
    );
  }

  return portfolioService.createPortfolio(ownerId, TEMPLATE, {
    title: BUSINESS_NAME,
    slug: DEMO_SLUG,
    visibility: "public",
    sections,
  });
}

async function main() {
  const email = requireEnv("DEMO_EMAIL").toLowerCase();
  const password = requireEnv("DEMO_PASSWORD");
  const mongoUri = requireEnv("MONGODB_URI");

  await connectMongo(mongoUri);

  const user = await upsertDemoUser(email, password);
  const portfolio = await upsertDemoPortfolio(user._id);
  await updatePortfolioArray(user._id);

  const siteUrl = publicSiteLine(portfolio.slug || DEMO_SLUG);
  console.log(
    JSON.stringify({
      userId: String(user._id),
      portfolioId: String(portfolio._id),
      slug: portfolio.slug || DEMO_SLUG,
      publicSiteUrl: siteUrl,
    }),
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});