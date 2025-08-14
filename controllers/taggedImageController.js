const TaggedImage = require("../models/TaggedImage");
const MenuItem = require("../models/MenuItems");

// Upload a new image
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const newImage = new TaggedImage({
      imageUrl: `/uploads/${req.file.filename}`,
      tags: [],
    });
    const saved = await newImage.save();
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload image" });
  }
};

// Add a new tag to an image
exports.addTag = async (req, res) => {
  const { x, y, label, menuItemId } = req.body;
  try {
    const image = await TaggedImage.findById(req.params.id);
    if (!image) return res.status(404).json({ error: "Image not found" });

    image.tags.push({ x, y, label, menuItem: menuItemId });
    await image.save();
    res.json(image);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add tag" });
  }
};

// Update a tag by image ID and tag index
exports.updateTag = async (req, res) => {
  const { x, y, label, menuItemId } = req.body;
  const { imageId, tagIndex } = req.params;
  console.log("PUT /api/tagged/:imageId/tags/:tagIndex", req.params, req.body);

  try {
    const image = await TaggedImage.findById(imageId);
    if (!image) return res.status(404).json({ error: "Image not found" });

    if (!image.tags[tagIndex])
      return res.status(404).json({ error: "Tag not found" });

    image.tags[tagIndex] = { x, y, label, menuItem: menuItemId };
    await image.save();
    res.json(image);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update tag" });
  }
};

// Delete a tag by image ID and tag index
exports.deleteTag = async (req, res) => {
  const { imageId, tagIndex } = req.params;

  try {
    const image = await TaggedImage.findById(imageId);
    if (!image) return res.status(404).json({ error: "Image not found" });

    if (!image.tags[tagIndex])
      return res.status(404).json({ error: "Tag not found" });

    image.tags.splice(tagIndex, 1);
    await image.save();
    res.json(image);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete tag" });
  }
};

// Get a single tagged image (with populated menu item info)
exports.getTaggedImage = async (req, res) => {
  try {
    const image = await TaggedImage.findById(req.params.id).populate(
      "tags.menuItem"
    );
    if (!image) return res.status(404).json({ error: "Image not found" });
    res.json(image);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
};

// Get all tagged images
exports.getAllTaggedImages = async (req, res) => {
  try {
    const images = await TaggedImage.find().populate("tags.menuItem");
    res.json(images);
  } catch (err) {
    console.error("Get All Tagged Images Error:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
};
