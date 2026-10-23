/**
 * One-time helper: normalize require() paths after moving MVC into src/legacy verticals.
 * Run from backend_findVirtualMe: node scripts/b2-fix-legacy-requires.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const legacyRoot = path.join(root, "src", "legacy");

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, files);
    else if (name.isFile() && name.name.endsWith(".js")) files.push(p);
  }
  return files;
}

function fixContent(relDir, text) {
  let c = text;
  // Shared: from legacy vertical (2 levels below src/) use ../../../shared/
  c = c.split("../../src/shared/").join("../../../shared/");
  c = c.replace(/require\((['"])\.\.\/\.\.\/src\/shared\//g, "require($1../../../shared/");
  // Old vertical model paths (two levels up to old models/<vertical>/)
  const pairs = [
    ["../../models/photographer/", "../models/"],
    ["../../models/healthcare/", "../models/"],
    ["../../models/handyMan/", "../models/"],
    ["../../models/localFoodVendor/", "../models/"],
    ["../../models/dataScientist/", "../models/"],
    ["../../models/projectManager/", "../models/"],
    ["../../controllers/photographer/", "../controllers/"],
    ["../../controllers/handyman/", "../controllers/"],
    ["../../controllers/localFoodVendor/", "../controllers/"],
    ["../../controllers/dataScientist/", "../controllers/"],
    ["../../controllers/projectManager/", "../controllers/"],
    ["../../oauthHandler", "../oauth-handler"],
    ["../../cloudinaryConfig", "../cloudinary-config"],
  ];
  for (const [from, to] of pairs) {
    c = c.split(from).join(to);
  }
  return c;
}

for (const file of walk(legacyRoot)) {
  const before = fs.readFileSync(file, "utf8");
  const after = fixContent(path.relative(legacyRoot, file), before);
  if (after !== before) fs.writeFileSync(file, after, "utf8");
}

console.log("Updated requires under", legacyRoot);
