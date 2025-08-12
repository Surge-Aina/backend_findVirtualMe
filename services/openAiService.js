// services/openaiService.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

async function generateMatchSummary(resumeJSON, jobText) {
  const prompt = `
    Match this resume to the job. List strong matches and missing areas briefly (max 150 words).

    Resume:
    ${JSON.stringify(resumeJSON, null, 2)}

    Job Description:
    ${jobText}

    Output format:
    ✓ Matches: skill1, skill2


    ✗ Missing: skill3, skill4

    
    Summary: [very short overall assessment]
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  return response.choices[0].message.content.trim();
}

module.exports = { generateMatchSummary };
