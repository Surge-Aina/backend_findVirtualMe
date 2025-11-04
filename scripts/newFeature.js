const fs = require("fs");
const path = require("path");

const featureName = process.argv[2];
if (!featureName) {
  console.error("Please provide a feature name: npm run new:feature <featureName>");
  process.exit(1);
}

// Utility to capitalize for class/function names
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const rootDir = path.resolve("microservices", featureName);
const testsDir = path.join(rootDir, "__tests__");

// --- Structure ---
const files = [
  `${featureName}.controller.js`,
  `${featureName}.model.js`,
  `${featureName}.routes.js`,
  `${featureName}.service.js`,
];

const testFiles = [
  `${featureName}.controller.test.js`,
  `${featureName}.model.test.js`,
  `${featureName}.service.test.js`,
];

// --- Prevent overwriting ---
if (fs.existsSync(rootDir)) {
  console.error(`Feature "${featureName}" already exists.`);
  process.exit(1);
}

// --- Create directories ---
fs.mkdirSync(testsDir, { recursive: true });

// --- Boilerplate templates ---
const templates = {
  controller: `// ${featureName}.controller.js
import * as ${featureName}Service from "./${featureName}.service.js";

export const get${capitalize(featureName)} = async (req, res) => {
  try {
    const data = await ${featureName}Service.get${capitalize(featureName)}();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
`,

  service: `// ${featureName}.service.js
export const get${capitalize(featureName)} = async () => {
  // Example logic here
  return { message: "${featureName} service working" };
};
`,

  model: `// ${featureName}.model.js
import mongoose from "mongoose";

const ${featureName}Schema = new mongoose.Schema({
  name: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("${capitalize(featureName)}", ${featureName}Schema);
`,

  routes: `// ${featureName}.routes.js
import express from "express";
import { get${capitalize(featureName)} } from "./${featureName}.controller.js";

const router = express.Router();

router.get("/", get${capitalize(featureName)});

export default router;
`,
};

// --- Create files ---
fs.writeFileSync(
  path.join(rootDir, `${featureName}.controller.js`),
  templates.controller
);
fs.writeFileSync(path.join(rootDir, `${featureName}.service.js`), templates.service);
fs.writeFileSync(path.join(rootDir, `${featureName}.model.js`), templates.model);
fs.writeFileSync(path.join(rootDir, `${featureName}.routes.js`), templates.routes);

// --- Create empty test files ---
testFiles.forEach((file) => {
  fs.writeFileSync(path.join(testsDir, file), "", "utf8");
});

console.log(`Created feature scaffold: microservices/${featureName}/`);
