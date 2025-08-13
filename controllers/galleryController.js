const GalleryImage = require("../models/GalleryImage");

exports.getAllGalleryImages = async (req, res) => {
  try {
    const images = await GalleryImage.find();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch gallery images" });
  }
};

exports.createGalleryImage = async (req, res) => {
  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const { caption } = req.body;

    if (!imageUrl)
      return res.status(400).json({ error: "Image file is required" });

    const newImage = new GalleryImage({ imageUrl, caption });
    const saved = await newImage.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Create error:", err);
    res.status(400).json({ error: "Failed to create gallery image" });
  }
};

exports.insertMultipleGalleryImage = async (req, res) => {
  try {
    const files = req.files; // expecting multiple files
    if (!files || files.length === 0)
      return res.status(400).json({ error: "No images provided" });

    const images = files.map((file, index) => ({
      imageUrl: `/uploads/${file.filename}`,
      caption: req.body.captions?.[index] || "", // assuming captions is an array of strings (optional)
    }));

    const saved = await GalleryImage.insertMany(images);
    res.status(201).json(saved);
  } catch (err) {
    console.error("Insert many error:", err);
    res.status(400).json({ error: "Failed to insert gallery images" });
  }
};

exports.updateGalleryImage = async (req, res) => {
  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const { caption } = req.body;

    const updatedData = {};
    if (caption !== undefined) updatedData.caption = caption;
    if (imageUrl) updatedData.imageUrl = imageUrl;

    const updated = await GalleryImage.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ error: "Gallery image not found" });

    res.json(updated);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Failed to update gallery image" });
  }
};

exports.deleteGalleryImage = async (req, res) => {
  try {
    const deleted = await GalleryImage.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Gallery image not found" });
    res.json({ message: "Gallery image deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete gallery image" });
  }
};
