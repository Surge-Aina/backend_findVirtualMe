const Banner = require("../models/Banner");

exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch banners" });
  }
};

exports.createBanner = async (req, res) => {
  try {
    const newBanner = new Banner({
      title: req.body.title,
      description: req.body.description,
      shape: req.body.shape || "blob",
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });

    const saved = await newBanner.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Create Banner Error:", err);
    res.status(400).json({ error: "Failed to create banner" });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      description: req.body.description,
      shape: req.body.shape,
    };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updated = await Banner.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updated) return res.status(404).json({ error: "Banner not found" });
    res.json(updated);
  } catch (err) {
    console.error("Update Banner Error:", err);
    res.status(500).json({ error: "Failed to update banner" });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const deleted = await Banner.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Banner not found" });
    res.json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete banner" });
  }
};
