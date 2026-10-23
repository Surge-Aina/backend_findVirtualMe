/**
 * Deterministic resume-text parser used when AI parsing is unavailable.
 * Output is limited to fields the portfolio schema can store.
 */

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MAX_LOCAL_TEXT = 20000;
const MAX_DATE_LINE = 300;

const SECTION_RULES = [
  ["summary", /^(summary|professional summary|profile|objective|about)\b[:\s-]*$/i],
  ["experience", /^(experience|work experience|professional experience|employment|work history)\b[:\s-]*$/i],
  ["education", /^(education|academic|academics)\b[:\s-]*$/i],
  ["skills", /^(skills|technical skills|core competencies|competencies)\b[:\s-]*$/i],
  ["projects", /^(projects|personal projects|selected projects)\b[:\s-]*$/i],
];

function clip(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function asStringList(value, maxItems, maxLen) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  for (const item of source) {
    const text = clip(item, maxLen);
    if (!text) continue;
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function parseSingleDate(token) {
  const text = String(token || "").trim();
  if (!text || text.length > 32) return null;
  if (/^(present|current|now|ongoing)$/i.test(text)) return null;

  const monthYear = text.match(/^([A-Za-z]{3,10})\.?\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase().replace(/\.$/, "")];
    const year = Number(monthYear[2]);
    if (month == null || year < 1950 || year > 2100) return null;
    return new Date(Date.UTC(year, month, 1));
  }

  const iso = text.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = iso[2] ? Number(iso[2]) - 1 : 0;
    const day = iso[3] ? Number(iso[3]) : 1;
    if (year < 1950 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  const slash = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const month = Number(slash[1]) - 1;
    const year = Number(slash[2]);
    if (month < 0 || month > 11 || year < 1950 || year > 2100) return null;
    return new Date(Date.UTC(year, month, 1));
  }

  return null;
}

function findRangeSplit(text) {
  const lower = text.toLowerCase();
  const markers = [" - ", " – ", " — ", " to "];
  let at = -1;
  let length = 0;
  for (const marker of markers) {
    const index = lower.indexOf(marker);
    if (index !== -1 && (at === -1 || index < at)) {
      at = index;
      length = marker.length;
    }
  }
  if (at === -1) {
    const compact = text.match(/^(\d{4})-(\d{4})$/);
    if (!compact) return null;
    return { left: compact[1], right: compact[2] };
  }
  return { left: text.slice(0, at).trim(), right: text.slice(at + length).trim() };
}

function dateFromEnd(chunk) {
  const words = String(chunk || "").split(/\s+/).filter(Boolean).slice(-3);
  for (let count = words.length; count >= 1; count -= 1) {
    const date = parseSingleDate(words.slice(-count).join(" "));
    if (date) return date;
  }
  return null;
}

function dateFromStart(chunk) {
  const words = String(chunk || "").split(/\s+/).filter(Boolean).slice(0, 3);
  if (!words.length) return { date: null, open: false };
  if (/^(present|current|now|ongoing)$/i.test(words[0])) return { date: null, open: true };
  for (let count = 1; count <= words.length; count += 1) {
    const date = parseSingleDate(words.slice(0, count).join(" "));
    if (date) return { date, open: false };
  }
  return { date: null, open: false };
}

function parseDateRange(line) {
  const text = String(line || "").trim();
  if (!text || text.length > MAX_DATE_LINE) return null;
  const split = findRangeSplit(text);
  if (!split) return null;
  const startDate = dateFromEnd(split.left);
  const end = dateFromStart(split.right);
  const endDate = end.open ? null : end.date;
  if (!startDate && !endDate) return null;
  return { startDate, endDate };
}

function splitSections(text) {
  const sections = { preamble: [] };
  let current = "preamble";
  for (const line of String(text || "").replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current !== "preamble") {
        sections[current] = sections[current] || [];
        sections[current].push("");
      }
      continue;
    }
    const header = SECTION_RULES.find(([, pattern]) => pattern.test(trimmed));
    if (header) {
      current = header[0];
      sections[current] = sections[current] || [];
      continue;
    }
    sections[current] = sections[current] || [];
    sections[current].push(trimmed);
  }
  return sections;
}

function blocks(lines) {
  const groups = [];
  let current = [];
  for (const line of lines || []) {
    if (!line) {
      if (current.length) groups.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) groups.push(current);
  return groups;
}

function findPhone(text) {
  const match = String(text || "").match(
    /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]\d{4}/,
  );
  return match ? match[0] : "";
}

function looksLikeContact(line) {
  return /@/.test(line) || findPhone(line) === line || /^https?:\/\//i.test(line) || /linkedin\.com|github\.com/i.test(line);
}

function isSectionHeader(line) {
  return SECTION_RULES.some(([, pattern]) => pattern.test(line));
}

function parseExperience(lines) {
  return blocks(lines).slice(0, 30).map((group) => {
    const rangeLine = group.find((line) => parseDateRange(line));
    const range = rangeLine ? parseDateRange(rangeLine) : null;
    const content = group.filter((line) => line !== rangeLine);
    const item = {
      company: clip(content[0], 160),
      title: clip(content[1], 160),
      description: clip(content.slice(2).join("\n"), 4000),
    };
    if (range && range.startDate) item.startDate = range.startDate;
    if (range && range.endDate) item.endDate = range.endDate;
    return item;
  }).filter((item) => item.company || item.title || item.description);
}

function parseEducation(lines) {
  return blocks(lines).slice(0, 20).map((group) => {
    const rangeLine = group.find((line) => parseDateRange(line));
    const range = rangeLine ? parseDateRange(rangeLine) : null;
    const content = group.filter((line) => line !== rangeLine);
    const degreeLine = content.find((line) => /\b(b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|ph\.?d\.?|bachelor|master|associate|doctor)\b/i.test(line));
    const school = content.find((line) => line !== degreeLine) || content[0] || "";
    const item = {
      school: clip(school, 200),
      degrees: degreeLine ? [clip(degreeLine, 160)] : [],
    };
    if (range && range.startDate) item.startDate = range.startDate;
    if (range && range.endDate) item.endDate = range.endDate;
    return item;
  }).filter((item) => item.school || item.degrees.length);
}

function parseProjects(lines) {
  return blocks(lines).slice(0, 30).map((group) => {
    const link = group.find((line) => /^https?:\/\//i.test(line)) || "";
    const content = group.filter((line) => line !== link);
    return {
      name: clip(content[0], 160),
      description: clip(content.slice(1).join("\n"), 4000),
      link: clip(link, 400),
    };
  }).filter((item) => item.name || item.description || item.link);
}

function parseSkills(lines) {
  const raw = (lines || []).filter(Boolean).join("\n");
  return asStringList(
    raw.split(/[,;|•·\n]/).map((part) => part.replace(/^[-*]\s*/, "")),
    80,
    80,
  );
}

function socialFrom(text) {
  const links = String(text || "").match(/https?:\/\/[^\s)]+/gi) || [];
  const social = {};
  for (const link of links) {
    const clean = link.replace(/[.,]+$/, "");
    if (!social.linkedin && /linkedin\.com/i.test(clean)) social.linkedin = clip(clean, 400);
    else if (!social.github && /github\.com/i.test(clean)) social.github = clip(clean, 400);
    else if (!social.twitter && /(twitter\.com|x\.com)\//i.test(clean)) social.twitter = clip(clean, 400);
    else if (!social.instagram && /instagram\.com/i.test(clean)) social.instagram = clip(clean, 400);
    else if (!social.website) social.website = clip(clean, 400);
  }
  return social;
}

function optionalDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = parseSingleDate(String(value).trim()) || null;
  if (parsed) return parsed;
  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) return undefined;
  const year = fallback.getUTCFullYear();
  if (year < 1950 || year > 2100) return undefined;
  return fallback;
}

function sanitizePortfolio(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const experiences = Array.isArray(source.experiences) ? source.experiences : [];
  const education = Array.isArray(source.education) ? source.education : [];
  const projects = Array.isArray(source.projects) ? source.projects : [];
  const social = source.socialLinks && typeof source.socialLinks === "object" ? source.socialLinks : {};

  const portfolio = {
    name: clip(source.name, 120),
    title: clip(source.title, 160),
    summary: clip(source.summary, 8000),
    phone: clip(source.phone, 40),
    location: clip(source.location, 160),
    skills: asStringList(source.skills, 80, 80),
    experiences: experiences.slice(0, 30).map((item) => {
      const row = item && typeof item === "object" ? item : {};
      const experience = {
        company: clip(row.company, 160),
        title: clip(row.title, 160),
        location: clip(row.location, 160),
        description: clip(row.description, 4000),
      };
      const startDate = optionalDate(row.startDate);
      const endDate = optionalDate(row.endDate);
      if (startDate) experience.startDate = startDate;
      if (endDate) experience.endDate = endDate;
      return experience;
    }).filter((item) => item.company || item.title || item.description || item.startDate),
    education: education.slice(0, 20).map((item) => {
      const row = item && typeof item === "object" ? item : {};
      const gpa = typeof row.gpa === "number" ? row.gpa : Number(row.gpa);
      const entry = {
        school: clip(row.school, 200),
        degrees: asStringList(row.degrees, 8, 160),
        fieldOfStudy: clip(row.fieldOfStudy, 160),
        awards: asStringList(row.awards, 8, 160),
        description: clip(row.description, 4000),
      };
      if (Number.isFinite(gpa)) entry.gpa = gpa;
      const startDate = optionalDate(row.startDate);
      const endDate = optionalDate(row.endDate);
      if (startDate) entry.startDate = startDate;
      if (endDate) entry.endDate = endDate;
      return entry;
    }).filter((item) => item.school || item.degrees.length || item.fieldOfStudy),
    projects: projects.slice(0, 30).map((item) => {
      const row = item && typeof item === "object" ? item : {};
      return {
        name: clip(row.name, 160),
        description: clip(row.description, 4000),
        link: clip(row.link, 400),
      };
    }).filter((item) => item.name || item.description || item.link),
    socialLinks: {
      github: clip(social.github, 400),
      linkedin: clip(social.linkedin, 400),
      twitter: clip(social.twitter, 400),
      instagram: clip(social.instagram, 400),
      website: clip(social.website, 400),
    },
  };

  if (source.bio) portfolio.bio = clip(source.bio, 8000);
  return portfolio;
}

function parseResumeLocally(text) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  const raw = source.length > MAX_LOCAL_TEXT ? source.slice(0, MAX_LOCAL_TEXT) : source;
  const sections = splitSections(raw);
  const preamble = (sections.preamble || []).filter((line) => line && !looksLikeContact(line) && !isSectionHeader(line));
  const locationLine = preamble.find((line) => /^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(line));
  const name = preamble.find((line) => line !== locationLine && /[A-Za-z]/.test(line) && line.length <= 80) || "";
  const title = preamble.find((line) => line !== name && line !== locationLine && line.length <= 80) || "";

  return sanitizePortfolio({
    name,
    title,
    summary: (sections.summary || []).filter(Boolean).join("\n"),
    phone: findPhone(raw),
    location: locationLine || "",
    skills: parseSkills(sections.skills),
    experiences: parseExperience(sections.experience),
    education: parseEducation(sections.education),
    projects: parseProjects(sections.projects),
    socialLinks: socialFrom(raw),
  });
}

module.exports = {
  parseResumeLocally,
  sanitizePortfolio,
};
