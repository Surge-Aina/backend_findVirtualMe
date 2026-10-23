/**
 * Undo mistaken B1 rewrites: legacy vertical models stayed under models/, not src/shared/models/.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const LEGACY_SEGMENTS = [
  "healthcare",
  "dataScientist",
  "handyMan",
  "localFoodVendor",
  "photographer",
  "projectManager",
  "softwareEngineer",
];

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

let changed = 0;
for (const file of walk(ROOT)) {
  let c = fs.readFileSync(file, "utf8");
  const orig = c;
  for (const seg of LEGACY_SEGMENTS) {
    c = c.split(`src/shared/models/${seg}/`).join(`models/${seg}/`);
  }
  if (c !== orig) {
    fs.writeFileSync(file, c, "utf8");
    changed++;
    console.log("fixed:", path.relative(ROOT, file));
  }
}
console.log("done, files:", changed);
