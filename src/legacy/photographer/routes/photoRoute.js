const express = require('express');
const Photo = require('../models/photoModel');
const { photographerWrite, isAdmin } = require('../../legacyWriteGuard');

const router = express.Router();

// GET all photos for a section
router.get('/:endpoint', async (req, res) => {
  try {
    const photos = await Photo.find({ endpoint: req.params.endpoint }).sort('position');
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST new photo
router.post('/:endpoint', ...photographerWrite, async (req, res) => {
  try {
    const { url } = req.body;
    const filter = { endpoint: req.params.endpoint };
    if (req.ownedPortfolioId) filter.portfolioId = req.ownedPortfolioId;
    const count = await Photo.countDocuments(filter);
    const newPhoto = new Photo({
      url,
      endpoint: req.params.endpoint,
      position: count,
      portfolioId: req.ownedPortfolioId,
    });
    const savedPhoto = await newPhoto.save();
    res.json(savedPhoto);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

// PUT reorder photos. Registered before /:id so "reorder" is not treated as an id.
router.put('/:endpoint/reorder', ...photographerWrite, async (req, res) => {
  try {
    const reordered = Array.isArray(req.body) ? req.body : [];
    for (const photo of reordered) {
      if (!photo || !photo._id) continue;
      const existing = await Photo.findById(photo._id).select("portfolioId");
      if (!existing) continue;
      if (
        existing.portfolioId &&
        req.ownedPortfolioId &&
        String(existing.portfolioId) !== String(req.ownedPortfolioId) &&
        !isAdmin(req.user)
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const $set = { position: photo.position };
      if (!existing.portfolioId && req.ownedPortfolioId === "default") {
        $set.portfolioId = "default";
      }
      await Photo.findByIdAndUpdate(photo._id, { $set });
    }
    res.json({ message: 'Photos reordered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

// PUT update photo
router.put('/:endpoint/:id', ...photographerWrite, async (req, res) => {
  try {
    const source = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const updates = {};
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith("$") || key === "portfolioId" || key === "endpoint") continue;
      updates[key] = value;
    }
    const existing = await Photo.findById(req.params.id).select("portfolioId");
    if (!existing) return res.status(404).json({ error: 'Photo not found' });
    if (!existing.portfolioId && req.ownedPortfolioId === "default") {
      updates.portfolioId = "default";
    }
    const updatedPhoto = await Photo.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updatedPhoto);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE photo
router.delete('/:endpoint/:id', ...photographerWrite, async (req, res) => {
  try {
    await Photo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
