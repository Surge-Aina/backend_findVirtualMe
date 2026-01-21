// const { userUtils, helpers } = require("../utils/aiPortfolioCreator.utils");
// // Default “Name Saver” templates as numbered lines
// const DEFAULT_FRONTEND_LINES = {
//   1: "<!DOCTYPE html>",
//   2: '<html lang="en">',
//   3: "  <head>",
//   4: '    <meta charset="UTF-8" />',
//   5: "    <title>Name Saver</title>",
//   6: "    <style>",
//   7: "      body { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; background: #111; color: #fff; }",
//   8: "      input, button { padding: 10px; margin: 6px; border-radius: 6px; border: none; }",
//   9: "      button { background: #4caf50; color: #fff; cursor: pointer; }",
//   10: "    </style>",
//   11: "  </head>",
//   12: "  <body>",
//   13: "    <h2>My Name is</h2>",
//   14: '    <input id="name" placeholder="Enter name" />',
//   15: '    <button onclick="save()">Save</button>',
//   16: '    <p id="msg"></p>',
//   17: "    <script>",
//   18: '      const url = "http://localhost:5000/name";',
//   19: "      async function load() {",
//   20: "        const res = await fetch(url);",
//   21: "        const data = await res.json();",
//   22: '        document.getElementById("name").value = data.name || "";',
//   23: "      }",
//   24: "      async function save() {",
//   25: '        const name = document.getElementById("name").value;',
//   26: "        const res = await fetch(url, {",
//   27: '          method: "POST",',
//   28: '          headers: { "Content-Type": "application/json" },',
//   29: "          body: JSON.stringify({ name })",
//   30: "        });",
//   31: '        document.getElementById("msg").innerText =',
//   32: '          res.ok ? "✅ Saved!" : "❌ Error saving";',
//   33: "      }",
//   34: "      load();",
//   35: "    </script>",
//   36: "  </body>",
//   37: "</html>",
// };

// const DEFAULT_BACKEND_LINES = {
//   1: 'import express from "express";',
//   2: 'import fs from "fs";',
//   3: "",
//   4: "const app = express();",
//   5: "app.use(express.json());",
//   6: 'app.use((_, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });',
//   7: "",
//   8: 'const FILE = "./data.json";',
//   9: "",
//   10: 'app.get("/name", (_, res) => {',
//   11: '  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, \'{"name":""}\');',
//   12: '  res.sendFile(FILE, { root: "." });',
//   13: "});",
//   14: "",
//   15: 'app.post("/name", (req, res) => {',
//   16: "  fs.writeFileSync(FILE, JSON.stringify({ name: req.body.name }));",
//   17: "  res.json({ name: req.body.name });",
//   18: "});",
//   19: "",
//   20: 'app.listen(3001, () => console.log("Server on 3001"));',
// };

// exports.getProjects = async (req, res) => {
//   try {
//     const user = await userUtils.getOrCreateUser();
//     res.json(user.projects.filter((p) => p.status !== "deleted").map(projectToClient));
//   } catch (error) {
//     res.json(error);
//     console.log(error);
//   }
// };

// exports.addProject = async (req, res) => {
//   try {
//     const name = req.body?.name || `Feature Test — ${new Date().toLocaleString()}`;
//     const user = await userUtils.getOrCreateUser();
//     const pid = helpers.newProjectId();
//     const newProj = {
//       projectId: pid,
//       name,
//       status: "active",
//       frontendJson: { lines: DEFAULT_FRONTEND_LINES },
//       backendJson: { lines: DEFAULT_BACKEND_LINES },
//       dataJson: { name: "" },
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     };
//     user.projects.push(newProj);
//     user.activeProjectId = pid;
//     user.updatedAt = new Date();
//     await user.save();
//     res.json({
//       ok: true,
//       project: helpers.projectToClient(newProj),
//       activeProjectId: pid,
//     });
//   } catch (error) {
//     res.json(error);
//     console.log(error);
//   }
// };

// exports.getProjectById = async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const user = await userUtils.getOrCreateUser();
//     const proj = user.projects.find(
//       (p) => p.projectId === projectId && p.status !== "deleted"
//     );
//     if (!proj) return res.status(404).json({ ok: false, error: "Project not found" });
//     res.json(helpers.projectToClient(proj));
//   } catch (error) {
//     res.json(error);
//     console.log(error);
//   }
// };

// exports.updateProject = async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const { frontendText, backendText } = req.body || {};
//     const user = await userUtils.getOrCreateUser();
//     const proj = user.projects.find(
//       (p) => p.projectId === projectId && p.status !== "deleted"
//     );
//     if (!proj) return res.status(404).json({ ok: false, error: "Project not found" });

//     const toLines = (txt) => {
//       const out = {};
//       txt.split("\n").forEach((line, i) => (out[String(i + 1)] = line));
//       return out;
//     };

//     if (typeof frontendText === "string") {
//       proj.frontendJson.lines = toLines(frontendText);
//     }
//     if (typeof backendText === "string") {
//       proj.backendJson.lines = toLines(backendText);
//     }
//     proj.updatedAt = new Date();
//     user.updatedAt = new Date();
//     await user.save();

//     res.json({ ok: true, project: helpers.projectToClient(proj) });
//   } catch (error) {
//     res.json(error);
//     console.log(error);
//   }
// };

// exports.deleteProject = async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const user = await userUtils.getOrCreateUser();
//     const proj = user.projects.find((p) => p.projectId === projectId);
//     if (!proj) return res.status(404).json({ ok: false, error: "Project not found" });
//     proj.status = "deleted";
//     if (user.activeProjectId === projectId) user.activeProjectId = "";
//     user.updatedAt = new Date();
//     await user.save();
//     res.json({ ok: true });
//   } catch (error) {
//     res.json(error);
//     console.log(error);
//   }
// };

// controllers/projects.controllers.js
const projectService = require("./projects.service");

exports.getProjects = async (req, res) => {
  try {
    const projects = await projectService.getProjects(req.user);
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

exports.addProject = async (req, res) => {
  try {
    const { name } = req.body || {};
    const result = await projectService.addProject(name, req.user);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await projectService.getProjectById(projectId, req.user);
    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { frontendText, backendText } = req.body || {};
    const project = await projectService.updateProject(
      projectId,
      frontendText,
      backendText,
      req.user
    );
    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
    res.json({ ok: true, project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const deleted = await projectService.deleteProject(projectId, req.user);
    if (!deleted) return res.status(404).json({ ok: false, error: "Project not found" });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
