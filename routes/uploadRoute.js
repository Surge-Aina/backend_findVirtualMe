const express = require('express');
const { upload, cloudinary } = require('../cloudinaryConfig');

const router = express.Router();

// Upload single image
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Return the Cloudinary URL
    res.json({
      url: req.file.path,
      public_id: req.file.filename,
      width: req.file.width,
      height: req.file.height
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Delete image from Cloudinary
router.delete('/image/:public_id', async (req, res) => {
  try {
    const { public_id } = req.params;
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(public_id);
    
    if (result.result === 'ok') {
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Upload multiple images
router.post('/images', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const uploadedImages = req.files.map(file => ({
      url: file.path,
      public_id: file.filename,
      width: file.width,
      height: file.height
    }));

    res.json({ images: uploadedImages });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

module.exports = router;