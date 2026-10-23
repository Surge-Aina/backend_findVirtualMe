const express = require('express');
const Photo = require('../models/photoModel');
const { adminOnly } = require('../../legacyWriteGuard');

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
router.post('/:endpoint', ...adminOnly, async (req, res) => {
  try {
    const { url } = req.body;
    const count = await Photo.countDocuments({ endpoint: req.params.endpoint });
    const newPhoto = new Photo({ url, endpoint: req.params.endpoint, position: count });
    const savedPhoto = await newPhoto.save();
    res.json(savedPhoto);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

// PUT reorder photos. Registered before /:id so "reorder" is not treated as an id.
router.put('/:endpoint/reorder', ...adminOnly, async (req, res) => {
  try {
    const reordered = Array.isArray(req.body) ? req.body : [];
    const updates = reordered.map((photo) =>
      Photo.findByIdAndUpdate(photo._id, { position: photo.position })
    );
    await Promise.all(updates);
    res.json({ message: 'Photos reordered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

// PUT update photo
router.put('/:endpoint/:id', ...adminOnly, async (req, res) => {
  try {
    const source = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const updates = {};
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith("$")) continue;
      updates[key] = value;
    }
    const updatedPhoto = await Photo.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updatedPhoto);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE photo
router.delete('/:endpoint/:id', ...adminOnly, async (req, res) => {
  try {
    await Photo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
