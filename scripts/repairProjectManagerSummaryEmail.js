/**
 * Repairs v2 projectManager portfolios whose summary block lacks an email by
 * backfilling from the owner user's email (when available).
 *
 * Usage:
 *   MONGODB_URI=... node scripts/repairProjectManagerSummaryEmail.js --dry-run
 *   MONGODB_URI=... node scripts/repairProjectManagerSummaryEmail.js --report-json=./reports/repair-pm-summary-email.json
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
  node scripts/repairProjectManagerSummaryEmail.js [--dry-run] [--report-json=path] [--dns-servers=8.8.8.8,1.1.1.1]

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

function normalizeString(value) {
  return (value || "").toString().trim();
}

function getSection(sections, type) {
  return (sections || []).find((section) => section.type === type) || null;
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

    const cursor = Portfolio.find({ template: "projectManager" }).cursor();
    for await (const doc of cursor) {
      report.scanned += 1;

      const summary = getSection(doc.sections, "summary");
      const currentEmail = normalizeString(summary?.data?.email);
      if (!summary || currentEmail) {
        report.skipped += 1;
        continue;
      }

      const ownerUser = doc.owner
        ? await User.findById(doc.owner).select("email").lean()
        : null;
      const ownerEmail = normalizeString(ownerUser?.email);
      if (!ownerEmail) {
        report.skipped += 1;
        continue;
      }

      report.eligible += 1;
      report.items.push({
        portfolioId: doc._id.toString(),
        ownerId: doc.owner ? doc.owner.toString() : "",
        nextEmail: ownerEmail,
      });

      if (!options.dryRun) {
        summary.data = { ...(summary.data || {}), email: ownerEmail };
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

