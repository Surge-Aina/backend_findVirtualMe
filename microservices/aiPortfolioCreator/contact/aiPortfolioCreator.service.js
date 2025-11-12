// backend/services/contact.service.js
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const CONTACTS_FILE = path.join(process.cwd(), "contacts.json");
const DATA_FILE = path.join(process.cwd(), "data.json");

async function ensureFile(file, fallback) {
  try {
    await fsp.access(file);
  } catch {
    await fsp.writeFile(file, fallback, "utf-8");
  }
}

async function readContacts() {
  await ensureFile(CONTACTS_FILE, "[]");
  const txt = await fsp.readFile(CONTACTS_FILE, "utf-8");
  return JSON.parse(txt);
}

async function writeContacts(list) {
  await fsp.writeFile(CONTACTS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

async function setLastSubmitter(name) {
  const payload = { name: String(name || "") };
  await ensureFile(DATA_FILE, JSON.stringify({ name: "" }, null, 2));
  await fsp.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

function sanitizeContact(obj, maxFields = 20) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Object.keys(out).length >= maxFields) break;
    if (typeof k !== "string" || !k) continue;
    if (["string", "number", "boolean"].includes(typeof v)) {
      out[k] = typeof v === "string" ? v.slice(0, 1000) : v;
    }
  }
  return out;
}

async function listContacts({ projectId, userName } = {}) {
  const list = await readContacts();
  return list.filter(
    (c) =>
      (projectId ? c.projectId === projectId : true) &&
      (userName ? c.userName === userName : true)
  );
}

async function createContact({ userName, projectId = "default", contact } = {}) {
  const clean = sanitizeContact(contact);
  if (!userName || !clean) throw new Error("userName and contact required");
  const entry = {
    id: "ct_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userName: String(userName),
    projectId: String(projectId),
    time: new Date().toISOString(),
    contact: clean,
  };
  const list = await readContacts();
  list.push(entry);
  await writeContacts(list);
  await setLastSubmitter(entry.userName);
  return entry;
}

async function updateContact(id, { userName, projectId, contact } = {}) {
  if (!id) throw new Error("id required");
  const list = await readContacts();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Not found");

  if (typeof userName === "string" && userName.trim()) {
    list[idx].userName = userName.trim();
    await setLastSubmitter(list[idx].userName);
  }
  if (typeof projectId === "string" && projectId.trim()) {
    list[idx].projectId = projectId.trim();
  }
  if (contact && typeof contact === "object") {
    const clean = sanitizeContact(contact);
    list[idx].contact = { ...list[idx].contact, ...clean };
  }
  list[idx].time = new Date().toISOString();
  await writeContacts(list);
  return list[idx];
}

async function bulkUpdate(updates = []) {
  if (!Array.isArray(updates) || !updates.length) {
    throw new Error("Array of updates required");
  }
  const list = await readContacts();
  const byId = Object.fromEntries(list.map((c) => [c.id, c]));
  const out = [];
  for (const u of updates) {
    const rec = byId[u.id];
    if (!rec) continue;
    if (typeof u.userName === "string" && u.userName.trim()) {
      rec.userName = u.userName.trim();
      await setLastSubmitter(rec.userName);
    }
    if (typeof u.projectId === "string" && u.projectId.trim()) {
      rec.projectId = u.projectId.trim();
    }
    if (u.contact && typeof u.contact === "object") {
      rec.contact = { ...rec.contact, ...sanitizeContact(u.contact) };
    }
    rec.time = new Date().toISOString();
    out.push(rec);
  }
  await writeContacts(Object.values(byId));
  return out;
}

// Ensure: return existing by (userName, projectId) or create a minimal stub
async function ensureContact({ userName, projectId = "default", template } = {}) {
  if (!userName) throw new Error("userName required");
  const list = await readContacts();
  const found = list.find((c) => c.userName === userName && c.projectId === projectId);
  if (found) return found;
  const stub =
    template && typeof template === "object" ? template : { email: "", message: "" };
  return createContact({ userName, projectId, contact: stub });
}

module.exports = {
  listContacts,
  createContact,
  updateContact,
  bulkUpdate,
  ensureContact,
  sanitizeContact,
  readContacts,
  writeContacts,
  setLastSubmitter,
  CONTACTS_FILE,
  DATA_FILE,
};
