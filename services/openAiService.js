// services/openaiService.js
const OpenAI = require("openai");

<<<<<<< HEAD
// Only initialize OpenAI if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, 
  });
}
=======
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
>>>>>>> c0056ec163268f833894dcc7cf72f284c4eca3cd

async function generateMatchSummary(resumeJSON, jobText) {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  
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

<<<<<<< HEAD
async function generatePortfolioJSON(resumeText, email){
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

=======
async function generatePortfolioJSON(resumeText, email) {
>>>>>>> c0056ec163268f833894dcc7cf72f284c4eca3cd
  const jsonAIPortfolioSchema = `{"name":"","title":"","summary":"","email":"","phone":"","location":"","skills":[],"experiences":[{"company":"","title":"","location":"","startDate":"","endDate":"","description":""}],"education":[{"school":"","gpa":"","degrees":[""],"fieldOfStudy":"","awards":[""],"startDate":"","endDate":"","description":""}],"projects":[{"name":"","description":""}],"socialLinks":{"github":"","linkedin":"","website":""}}`;

  const omsJSONPortfolioAPISchema =
    '{"about":{"name":"","phone":"","address":"","linkedin":"","github":"","portfolio":"","link1":"","link2":""},"education":[{"degree":"","institution":"","year":"","points":[]}],"skills":[],"projects":[{"name":"","about":"","time":"","points":[]}],"experience":[{"company":"","role":"","duration":"","points":[]}],"certificates":[],"testimonials":[],"extraParts":[{"title":"","content":""}]}';

  let prompt = `
      Convert this resume text into valid JSON following EXACTLY this structure (keep all keys even if values are empty):

      ${jsonAIPortfolioSchema}

      Rules:
      - Output ONLY valid JSON.
      - Do NOT include Markdown code fences. (\`\`\`json or \`\`\`)
      - Keep the same keys and array structures.
      - Do not add extra keys.
      - Dates should be in YYYY-MM-DD format if available or null(without quotes)

      Resume text:
      ${resumeText}
    `;

  if (email) {
    prompt = prompt + `also replace email with ${email}`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0].message.content.trim();
}

async function generateVendorPortfolioJSON(vendorText) {
  const vendorPortfolioSchema = `{
    "vendorInfo": { "name": "", "description": "", "contact": "", "location": "" },
    "banner": { "title": "", "description": "", "image": "", "shape": "" },
    "about": {
      "banner": { "image": "", "title": "", "description": "", "shape": "" },
      "contentBlocks": [{ "heading": "", "subheading": "" }],
      "gridImages": []
    },
    "menuItems": [{ "name": "", "description": "", "price": 0, "category": "", "isAvailable": true, "unavailableUntil": null, "image": "" }],
    "reviews": [{ "name": "", "feedback": "", "rating": 0, "image": "", "date": null }],
    "gallery": [{ "imageUrl": "", "caption": "" }],
    "taggedImages": [{ "imageUrl": "", "tags": [{ "x": 0, "y": 0, "menuItem": "", "label": "" }] }]
  }`;

  const prompt = `
  Convert this vendor description into valid JSON following EXACTLY this structure (keep all keys even if values are empty):

  ${vendorPortfolioSchema}

  Rules:
  - Output ONLY valid JSON.
  - Do NOT include Markdown code fences.
  - Keep the same keys and array structures.
  - Do not add extra keys.
  - Dates should be in YYYY-MM-DD format if available or null.
  
  Vendor description:
  ${vendorText}
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0].message.content.trim();
}

module.exports = {
  generateMatchSummary,
  generatePortfolioJSON,
  generateVendorPortfolioJSON,
};
