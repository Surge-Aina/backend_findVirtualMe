const express = require("express");

const router = express.Router();
const { userUtils, helpers } = require("./utils/aiPortfolioCreator.utils");

router.post("/", async (req, res) => {
  try {
    const { projectId, target, prompt } = req.body || {};
    // Validate: only one file per request; allowed: 'frontend' or 'backend'
    if (!projectId || !["frontend", "backend"].includes(target)) {
      return res.status(400).json({ ok: false, error: "Invalid projectId or target" });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY missing in .env" });
    }

    const user = await userUtils.getOrCreateUser();
    const proj = user.projects.find(
      (p) => p.projectId === projectId && p.status !== "deleted"
    );
    if (!proj) return res.status(404).json({ ok: false, error: "Project not found" });

    // Select source text (only the chosen file)
    const sourceText =
      target === "frontend"
        ? helpers.linesToTextFromObj(proj.frontendJson?.lines || {})
        : helpers.linesToTextFromObj(proj.backendJson?.lines || {});
    const userPrompt = (prompt || "").trim();

    // Build instruction so model returns strict JSON
    const systemPrompt = `
You are an assistant that edits a web scaffolding file and writes a short promotional tweet.
Return a strict JSON object with keys:
- "tweet": a very short promotional tweet about the project update (max 200 chars, no hashtags required).
- "frontendLines" (optional): when target is "frontend", return the UPDATED file as numbered lines mapping: {"1": "...", "2": "..."}.
- "backendLines" (optional): when target is "backend", same idea as above but for backend.

Rules:
- If you change nothing, still return the lines mapping (unchanged).
- Do not include markdown, backticks, or any extra text outside the JSON.
- The file content must remain valid for its role.
`.trim();

    const body = {
      model: "gpt-4o-mini", // lightweight good choice for this MVP
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `TARGET: ${target.toUpperCase()}
USER_REQUEST: ${userPrompt || "(no extra instructions)"}
CURRENT_FILE:
${sourceText}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.log(err);
      return res
        .status(502)
        .json({ ok: false, error: "OpenAI error", detail: err.slice(0, 1000) });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Failed to parse model JSON" });
    }

    const tweet = parsed.tweet || "";

    // If we got updated lines mapping, apply them to the project (but only for the selected file)
    const toLinesObj = (text) => {
      const obj = {};
      (text || "").split("\n").forEach((ln, i) => (obj[String(i + 1)] = ln));
      return obj;
    };

    // The model should return a *mapping* already; however, defend both cases:
    if (target === "frontend") {
      let lines = parsed.frontendLines;
      if (!lines || Array.isArray(lines)) {
        // if model returned a full text accidentally, convert to mapping
        lines = Array.isArray(lines)
          ? lines.reduce((acc, v, i) => ((acc[String(i + 1)] = v), acc), {})
          : lines;
      }
      if (typeof lines === "object" && lines !== null) {
        proj.frontendJson.lines = lines;
      }
    } else if (target === "backend") {
      let lines = parsed.backendLines;
      if (!lines || Array.isArray(lines)) {
        lines = Array.isArray(lines)
          ? lines.reduce((acc, v, i) => ((acc[String(i + 1)] = v), acc), {})
          : lines;
      }
      if (typeof lines === "object" && lines !== null) {
        proj.backendJson.lines = lines;
      }
    }

    proj.updatedAt = new Date();
    user.updatedAt = new Date();
    await user.save();

    res.json({
      ok: true,
      tweet,
      project: helpers.projectToClient(proj),
    });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, error: e.message?.slice(0, 300) || "Server error" });
  }
});

module.exports = router;
