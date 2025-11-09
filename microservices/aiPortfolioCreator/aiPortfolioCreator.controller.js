// backend/routes/contact.routes.js
const express = require("express");
const router = express.Router();
const svc = require("./aiPortfolioCreator.service");

// GET all (optional filters: ?projectId=&userName=)
exports.listContacts = async (req, res) => {
  try {
    const { projectId, userName } = req.query || {};
    const out = await svc.listContacts({ projectId, userName });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "Read failed", detail: e.message });
  }
};

// POST create
exports.createContact = async (req, res) => {
  try {
    const { userName, projectId, contact } = req.body || {};
    const entry = await svc.createContact({ userName, projectId, contact });
    res.status(201).json(entry);
  } catch (e) {
    const code = /required/i.test(e.message) ? 400 : 500;
    res.status(code).json({ error: e.message });
  }
};

// PATCH update by id
exports.updateContact = async (req, res) => {
  try {
    const out = await svc.updateContact(req.params.id, req.body || {});
    res.json(out);
  } catch (e) {
    const code = /Not found/i.test(e.message) ? 404 : 500;
    res.status(code).json({ error: e.message });
  }
};

// PATCH bulk
exports.bulkUpdate = async (req, res) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : [];
    const out = await svc.bulkUpdate(updates);
    res.json(out);
  } catch (e) {
    const code = /required/i.test(e.message) ? 400 : 500;
    res.status(code).json({ error: e.message });
  }
};
