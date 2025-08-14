const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  caption: String
}, { timestamps: true });

module.exports = mongoose.model('GalleryImage', galleryImageSchema);