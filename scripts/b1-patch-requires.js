/**
 * One-time B1 migration: fix require() paths after moving shared code to src/shared/.
 * Run: node scripts/b1-patch-requires.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "coverage" || e.name === ".git")
      continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".js")) yield p;
  }
}

function patchContent(rel, content) {
  let c = content;
  const inShared = rel.replace(/\\/g, "/").startsWith("src/shared/");
  const inEmailmvp = rel.replace(/\\/g, "/").startsWith("microservices/emailmvp/");

  if (!inShared && !inEmailmvp) {
    const chains = ["../../../../", "../../../", "../../", "../"];
    for (const ch of chains) {
      c = c.replaceAll(`${ch}models/`, `${ch}src/shared/models/`);
      c = c.replaceAll(`${ch}middleware/`, `${ch}src/shared/middleware/`);
      c = c.replaceAll(`${ch}services/`, `${ch}src/shared/services/`);
      c = c.replaceAll(`${ch}utils/`, `${ch}src/shared/utils/`);
    }
  }

  if (inShared && !rel.replace(/\\/g, "/").includes("emailmvp")) {
    if (
      rel.replace(/\\/g, "/").startsWith("src/shared/services/") ||
      rel.replace(/\\/g, "/").startsWith("src/shared/utils/")
    ) {
      c = c.replaceAll("../microservices/", "../../microservices/");
    }
  }

  const relPosix = rel.replace(/\\/g, "/");
  if (relPosix === "src/index.js") {
    c = c.replaceAll('require("./routes/', 'require("../routes/');
    c = c.replaceAll('require("./microservices/', 'require("../microservices/');
    c = c.replaceAll('require("./oauthHandler")', 'require("../oauthHandler")');
    c = c.replace('require("./config")', 'require("./shared/config/app.config.js")');
    c = c.replace('require("./models/User")', 'require("./shared/models/User")');
    c = c.replace(/const connectDB = require\("\.\/utils\/db"\)[^\n]*\n/, "");
    c = c.replace(
      'require("./routes/portfolio.routes")',
      'require("../routes/portfolio.routes")',
    );
    c = c.replace(
      'path.join(__dirname, "uploads")',
      'path.join(__dirname, "..", "uploads")',
    );
    c = c.replace(
      "path.join(__dirname, config.uploads.directory)",
      "path.join(__dirname, \"..\", config.uploads.directory)",
    );
  }

  if (relPosix === "src/server.js") {
    c = c.replace('require("./utils/db")', 'require("./shared/utils/db")');
    c = c.replace(
      'require("./microservices/S3Upload/gcOrphanImages")',
      'require("../microservices/S3Upload/gcOrphanImages")',
    );
  }

  if (relPosix === "src/shared/utils/cloudinaryUpload.js") {
    c = c.replace(
      "require('../config/cloudinary')",
      "require('../../cloudinaryConfig')",
    );
  }

  return c;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const orig = fs.readFileSync(file, "utf8");
  const next = patchContent(rel, orig);
  if (next !== orig) {
    fs.writeFileSync(file, next, "utf8");
    changed++;
    console.log("patched:", rel);
  }
}
console.log("done, files changed:", changed);
