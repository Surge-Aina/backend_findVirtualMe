const fs = require("fs");
const path = require("path");

const featureName = process.argv[2];

if (!featureName) {
  console.error("Please provide a feature name: npm run new:feature <featureName>");
  process.exit(1);
}

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const rootDir = path.resolve("microservices", featureName);
const testsDir = path.join(rootDir, "__tests__");

// Prevent overwriting old feature
if (fs.existsSync(rootDir)) {
  console.error(`❌ Feature "${featureName}" already exists.`);
  process.exit(1);
}

// Create directory structure
fs.mkdirSync(testsDir, { recursive: true });

console.log(`📁 Creating feature: ${featureName} ...`);

// ---------------------- BOILERPLATE CONTENT ----------------------

const templates = {
  controller: `// ${featureName}.controller.js
const ${featureName}Service = require("./${featureName}.service");

exports.get${capitalize(featureName)} = async (req, res) => {
  try {
    const data = await ${featureName}Service.get${capitalize(featureName)}();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
`,

  service: `// ${featureName}.service.js
exports.get${capitalize(featureName)} = async () => {
  return { message: "${featureName} service working" };
};
`,

  model: `// ${featureName}.model.js
const mongoose = require("mongoose");

const ${featureName}Schema = new mongoose.Schema({
  name: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("${capitalize(featureName)}", ${featureName}Schema);
`,

  routes: `// ${featureName}.routes.js
const express = require("express");
const { get${capitalize(featureName)} } = require("./${featureName}.controller");

const router = express.Router();

router.get("/", get${capitalize(featureName)});

module.exports = router;
`,
};

// ---------------------- WRITE FILES ----------------------

const fileNames = [
  `${featureName}.controller.js`,
  `${featureName}.service.js`,
  `${featureName}.model.js`,
  `${featureName}.routes.js`,
];

fileNames.forEach((file) => {
  const templateKey = file.split(".")[1]; // controller, model, routes, service
  fs.writeFileSync(path.join(rootDir, file), templates[templateKey], "utf8");
});

// Create empty test files
[
  `${featureName}.controller.test.js`,
  `${featureName}.service.test.js`,
  `${featureName}.model.test.js`,
].forEach((testFile) => {
  fs.writeFileSync(path.join(testsDir, testFile), "", "utf8");
});

console.log(`✅ Done! Feature scaffold created at: microservices/${featureName}/`);
