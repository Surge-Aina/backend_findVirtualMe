const express = require('express');
const Photo = require('../models/photoModel');

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
router.post('/:endpoint', async (req, res) => {
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

// PUT update photo
router.put('/:endpoint/:id', async (req, res) => {
  try {
    const updatedPhoto = await Photo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedPhoto);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE photo
router.delete('/:endpoint/:id', async (req, res) => {
  try {
    await Photo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// PUT reorder photos
router.put('/:endpoint/reorder', async (req, res) => {
  try {
    const reordered = req.body; // array of { _id, position }
    const updates = reordered.map((photo) =>
      Photo.findByIdAndUpdate(photo._id, { position: photo.position })
    );
    await Promise.all(updates);
    res.json({ message: 'Photos reordered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

module.exports = router;
