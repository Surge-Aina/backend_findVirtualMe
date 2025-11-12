const TaggedImage = require("../../models/localFoodVendor/TaggedImage");
const { uploadToS3, deleteFromS3 } = require("../../services/s3Service");

const S3_PREFIX = "Ports/HandyMan";

function keyFromUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const uploaded = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      S3_PREFIX
    );

    const newImage = new TaggedImage({
      vendorId: req.params.vendorId,
      imageUrl: uploaded.url,
      key: uploaded.key,
      tags: [],
    });

    const saved = await newImage.save();
    res.json(saved);
  } catch (err) {
    console.error("Tagged image upload error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
};

//  Add a new tag
exports.addTag = async (req, res) => {
  const { x, y, label, menuItemId } = req.body;
  try {
    const image = await TaggedImage.findOne({
      _id: req.params.imageId,
      vendorId: req.params.vendorId,
    });
    if (!image) return res.status(404).json({ error: "Image not found" });

    image.tags.push({ x, y, label, menuItem: menuItemId });
    await image.save();
    res.json(image);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add tag" });
  }
};

// Update a tag
exports.updateTag = async (req, res) => {
  const { x, y, label, menuItemId } = req.body;
  const { imageId, tagIndex } = req.params;

  try {
    const image = await TaggedImage.findOne({
      _id: imageId,
      vendorId: req.params.vendorId,
    });
    if (!image) return res.status(404).json({ error: "Image not found" });

    if (!image.tags[tagIndex])
      return res.status(404).json({ error: "Tag not found" });

    image.tags[tagIndex] = { x, y, label, menuItem: menuItemId };
    await image.save();
    res.json(image);
  } catch (err) {
    console.error("Update tag error:", err);
    res.status(500).json({ error: "Failed to update tag" });
  }
};

// Delete a tag
exports.deleteTag = async (req, res) => {
  const { imageId, tagIndex } = req.params;
  try {
    const image = await TaggedImage.findOne({
      _id: imageId,
      vendorId: req.params.vendorId,
    });
    if (!image) return res.status(404).json({ error: "Image not found" });

    if (!image.tags[tagIndex])
      return res.status(404).json({ error: "Tag not found" });

    image.tags.splice(tagIndex, 1);
    await image.save();
    res.json(image);
  } catch (err) {
    console.error("Delete tag error:", err);
    res.status(500).json({ error: "Failed to delete tag" });
  }
};

//  Get a single tagged image
exports.getTaggedImage = async (req, res) => {
  try {
    const image = await TaggedImage.findOne({
      _id: req.params.imageId,
      vendorId: req.params.vendorId,
    }).populate("tags.menuItem");
    if (!image) return res.status(404).json({ error: "Image not found" });
    res.json(image);
  } catch (err) {
    console.error("Fetch tagged image error:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
};

//  Get all tagged images
exports.getAllTaggedImages = async (req, res) => {
  try {
    const images = await TaggedImage.find({
      vendorId: req.params.vendorId,
    }).populate("tags.menuItem");
    res.json(images);
  } catch (err) {
    console.error("Get All Tagged Images Error:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
};

//  Optional cleanup endpoint for future (when deleting full image)
exports.deleteTaggedImage = async (req, res) => {
  try {
    const image = await TaggedImage.findOneAndDelete({
      _id: req.params.imageId,
      vendorId: req.params.vendorId,
    });
    if (!image) return res.status(404).json({ error: "Image not found" });

    const key = image.key || keyFromUrl(image.imageUrl);
    if (key) {
      try {
        await deleteFromS3(key);
        console.log("Deleted tagged image from S3:", key);
      } catch (e) {
        console.warn("S3 delete failed:", e.message);
      }
    }

    res.json({ message: "Tagged image deleted" });
  } catch (err) {
    console.error("Delete tagged image error:", err);
    res.status(500).json({ error: "Failed to delete tagged image" });
  }
};
