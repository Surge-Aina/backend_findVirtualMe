/**
 * Repairs v2 handyman portfolios whose contact block lacks phone/email by
 * backfilling contact.phone from hero.phoneNumber when available.
 *
 * Usage:
 *   MONGODB_URI=... node scripts/repairHandymanContact.js --dry-run
 *   MONGODB_URI=... node scripts/repairHandymanContact.js --report-json=./reports/repair-handyman-contact.json
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");

const Portfolio = require("../models/portfolio/Portfolio");
const User = require("../models/User");

function parseArgs(argv) {
  const options = {
    dryRun: false,
    reportJsonPath: "",
    dnsServers: [],
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg.startsWith("--report-json=")) {
      options.reportJsonPath = (arg.split("=")[1] || "").trim();
      if (!options.reportJsonPath) throw new Error("--report-json requires a file path");
      continue;
    }
    if (arg.startsWith("--dns-servers=")) {
      const selected = (arg.split("=")[1] || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (!selected.length) throw new Error("--dns-servers requires a comma-separated list");
      options.dnsServers = selected;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/repairHandymanContact.js [--dry-run] [--report-json=path] [--dns-servers=8.8.8.8,1.1.1.1]

Options:
  --dry-run            Report changes without writing
  --report-json=...    Write machine-readable report JSON
  --dns-servers=...    Optional DNS servers used for SRV lookup in this Node process
  --help, -h           Show this help message
  `);
}

function writeJsonReport(filePath, report) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}

function resolveDnsServers(options) {
  if (options.dnsServers.length) return options.dnsServers;
  return (process.env.MIGRATION_DNS_SERVERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSection(sections, type) {
  return (sections || []).find((section) => section.type === type) || null;
}

function normalizeString(value) {
  return (value || "").toString().trim();
}

async function resolveOwnerUser(ownerId) {
  if (!ownerId) return null;
  return User.findById(ownerId).select("email phone").lean();
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    const dnsServers = resolveDnsServers(options);
    if (dnsServers.length) {
      dns.setServers(dnsServers);
      console.log(`Using custom DNS servers for repair: ${dnsServers.join(", ")}`);
    }

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error("Set MONGODB_URI or MONGO_URI in env");

    await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    const report = {
      startedAt: new Date().toISOString(),
      options: {
        dryRun: options.dryRun,
        dnsServers,
      },
      scanned: 0,
      eligible: 0,
      updated: 0,
      skipped: 0,
      items: [],
    };

    const cursor = Portfolio.find({ template: "handyman" }).cursor();
    for await (const doc of cursor) {
      report.scanned += 1;

      const hero = getSection(doc.sections, "hero");
      const contact = getSection(doc.sections, "contact");
      const heroPhone = normalizeString(hero?.data?.phoneNumber);
      const contactPhone = normalizeString(contact?.data?.phone);
      const contactEmail = normalizeString(contact?.data?.email);

      if (!contact) {
        report.skipped += 1;
        continue;
      }

      if (contactPhone || contactEmail) {
        report.skipped += 1;
        continue;
      }

      const ownerUser = await resolveOwnerUser(doc.owner);
      const ownerPhone = normalizeString(ownerUser?.phone);
      const ownerEmail = normalizeString(ownerUser?.email);

      const nextPhone = heroPhone || ownerPhone;
      const nextEmail = nextPhone ? "" : ownerEmail; // prefer phone if available

      const needsBackfill = !!(nextPhone || nextEmail);
      if (!needsBackfill) {
        report.skipped += 1;
        continue;
      }

      report.eligible += 1;
      report.items.push({
        portfolioId: doc._id.toString(),
        heroPhone,
        ownerUserFound: !!ownerUser,
        ownerPhone,
        ownerEmail,
        previousContact: { phone: contactPhone, email: contactEmail },
        nextContact: { phone: nextPhone, email: nextEmail },
      });

      if (!options.dryRun) {
        contact.data = {
          ...(contact.data || {}),
          phone: nextPhone,
          email: nextEmail,
        };
        await doc.save();
        report.updated += 1;
      }
    }

    report.completedAt = new Date().toISOString();

    console.log("\nRepair summary:");
    console.log(JSON.stringify(report, null, 2));

    if (options.reportJsonPath) {
      const out = writeJsonReport(options.reportJsonPath, report);
      console.log(`\nReport written to ${out}`);
    }

    await mongoose.disconnect();
    console.log("Done.");
  } catch (err) {
    console.error("Repair failed:", err?.message || err);
    process.exit(1);
  }
}

main();

