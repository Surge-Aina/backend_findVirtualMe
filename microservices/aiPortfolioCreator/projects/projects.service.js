// services/projects.service.js
const { userUtils, helpers } = require("../utils/aiPortfolioCreator.utils");

const DEFAULT_FRONTEND_LINES = {
  1: "<!DOCTYPE html>",
  2: '<html lang="en">',
  3: "  <head>",
  4: '    <meta charset="UTF-8" />',
  5: "    <title>Name Saver</title>",
  6: "    <style>",
  7: "      body { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; background: #111; color: #fff; }",
  8: "      input, button { padding: 10px; margin: 6px; border-radius: 6px; border: none; }",
  9: "      button { background: #4caf50; color: #fff; cursor: pointer; }",
  10: "    </style>",
  11: "  </head>",
  12: "  <body>",
  13: "    <h2>My Name is</h2>",
  14: '    <input id="name" placeholder="Enter name" />',
  15: '    <button onclick="save()">Save</button>',
  16: '    <p id="msg"></p>',
  17: "    <script>",
  18: "      const API = window.API_URL || 'http://localhost:5000'", // dynamic base URL
  19: "      const url = `${API}/name`;",
  20: "      const token = window.TOKEN;",
  21: "      console.log('token: 1111: ', token);",
  22: "      async function load() {",
  23: "        const res = await fetch(url, {",
  24: "          headers: { Authorization: `Bearer ${token}` }",
  25: "        });",
  26: "        const data = await res.json();",
  27: "        document.getElementById('name').value = data.name || '';",
  28: "      }",
  29: "      ",
  30: "      async function save() {",
  31: "        const name = document.getElementById('name').value;",
  32: "        const res = await fetch(url, {",
  33: "          method: 'POST',",
  34: "          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },",
  35: "          body: JSON.stringify({ name })",
  36: "        });",
  37: "        document.getElementById('msg').innerText = res.ok ? '✅ Saved!' : '❌ Error saving';",
  38: "      }",
  39: "      ",
  40: "      load();",
  41: "    </script>",
  42: "  </body>",
  43: "</html>",
};
const DEFAULT_BACKEND_LINES = {
  1: 'import express from "express";',
  2: 'import fs from "fs";',
  3: "",
  4: "const app = express();",
  5: "app.use(express.json());",
  6: 'app.use((_, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });',
  7: "",
  8: 'const FILE = "./data.json";',
  9: "",
  10: 'app.get("/name", (_, res) => {',
  11: '  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, \'{"name":""}\');',
  12: '  res.sendFile(FILE, { root: "." });',
  13: "});",
  14: "",
  15: 'app.post("/name", (req, res) => {',
  16: "  fs.writeFileSync(FILE, JSON.stringify({ name: req.body.name }));",
  17: "  res.json({ name: req.body.name });",
  18: "});",
  19: "",
  20: 'app.listen(3001, () => console.log("Server on 3001"));',
};

function cloneLines(linesObj) {
  // Prevent accidental shared references between projects.
  // Values are strings so JSON clone is sufficient as a fallback.
  if (!linesObj || typeof linesObj !== "object") return {};
  if (typeof structuredClone === "function") return structuredClone(linesObj);
  return JSON.parse(JSON.stringify(linesObj));
}

function projectToClient(project) {
  return helpers.projectToClient(project);
}

exports.getProjects = async (user) => {
  // const user = await userUtils.getOrCreateUser(userId);
  return user.projects.filter((p) => p.status !== "deleted").map(projectToClient);
};

exports.addProject = async (name, user) => {
  // const user = await userUtils.getOrCreateUser(userId);
  const pid = helpers.newProjectId();
  const projectName = name || `Feature Test — ${new Date().toLocaleString()}`;
  const newProj = {
    projectId: pid,
    name: projectName,
    status: "active",
    frontendJson: { lines: cloneLines(DEFAULT_FRONTEND_LINES) },
    backendJson: { lines: cloneLines(DEFAULT_BACKEND_LINES) },
    dataJson: { name: "" },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  user.projects.push(newProj);
  user.activeProjectId = pid;
  user.updatedAt = new Date();
  await user.save();
  return { project: projectToClient(newProj), activeProjectId: pid };
};

exports.getProjectById = async (projectId, user) => {
  // const user = await userUtils.getOrCreateUser(userId);
  const proj = user.projects.find(
    (p) => p.projectId === projectId && p.status !== "deleted"
  );
  if (!proj) return null;
  //return projectToClient(proj);
  return proj;
};

exports.updateProject = async (projectId, frontendText, backendText, user) => {
  // const user = await userUtils.getOrCreateUser(userId);
  const proj = user.projects.find(
    (p) => p.projectId === projectId && p.status !== "deleted"
  );
  if (!proj) return null;

  const toLines = (txt) => {
    const out = {};
    txt.split("\n").forEach((line, i) => (out[String(i + 1)] = line));
    return out;
  };

  if (typeof frontendText === "string") {
    proj.frontendJson.lines = toLines(frontendText);
  }
  if (typeof backendText === "string") {
    proj.backendJson.lines = toLines(backendText);
  }
  proj.updatedAt = new Date();
  user.updatedAt = new Date();
  await user.save();

  return projectToClient(proj);
};

exports.deleteProject = async (projectId, user) => {
  //const user = await userUtils.getOrCreateUser(userId);
  const proj = user.projects.find((p) => p.projectId === projectId);
  if (!proj) return null;
  proj.status = "deleted";
  if (user.activeProjectId === projectId) user.activeProjectId = "";
  user.updatedAt = new Date();
  await user.save();
  return true;
};
