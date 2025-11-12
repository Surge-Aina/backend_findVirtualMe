const { userUtils, helpers } = require("../utils/aiPortfolioCreator.utils");

exports.createPromo = async ({ projectId, target, prompt }, user) => {
  if (!projectId || !["frontend", "backend"].includes(target)) {
    throw new Error("Invalid projectId or target");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in .env");
  }

  // const user = await userUtils.getOrCreateUser(userId);
  const proj = user.projects.find(
    (p) => p.projectId === projectId && p.status !== "deleted"
  );
  if (!proj) throw new Error("Project not found");

  const sourceText =
    target === "frontend"
      ? helpers.linesToTextFromObj(proj.frontendJson?.lines || {})
      : helpers.linesToTextFromObj(proj.backendJson?.lines || {});
  const userPrompt = (prompt || "").trim();

  const systemPrompt = `
You are an assistant that edits a web scaffolding file and writes a short promotional tweet.
Return a strict JSON object with keys:
- "tweet": a very short promotional tweet about the project update (max 200 chars, no hashtags required).
- "frontendLines" (optional): updated frontend lines.
- "backendLines" (optional): updated backend lines.

Rules:
- If you change nothing, still return the lines mapping (unchanged).
- Do not include markdown, backticks, or any extra text outside the JSON.
- The file content must remain valid for its role.
`.trim();

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `TARGET: ${target.toUpperCase()}\nUSER_REQUEST: ${
          userPrompt || "(no extra instructions)"
        }\nCURRENT_FILE:\n${sourceText}`,
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
    throw new Error("OpenAI error: " + err.slice(0, 300));
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse model JSON");
  }

  const tweet = parsed.tweet || "";
  const linesKey = target === "frontend" ? "frontendLines" : "backendLines";
  const newLines = parsed[linesKey];

  if (newLines && typeof newLines === "object") {
    if (target === "frontend") proj.frontendJson.lines = newLines;
    else proj.backendJson.lines = newLines;
  }

  proj.updatedAt = new Date();
  user.updatedAt = new Date();
  await user.save();

  return {
    ok: true,
    tweet,
    project: helpers.projectToClient(proj),
  };
};
