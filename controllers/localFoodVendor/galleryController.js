const GalleryImage = require("../../models/localFoodVendor/GalleryImage");
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

exports.getAllGalleryImages = async (req, res) => {
  try {
    const images = await GalleryImage.find({ vendorId: req.params.vendorId });
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch gallery images" });
  }
};

exports.createGalleryImage = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "Image file is required" });

    const uploaded = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      S3_PREFIX
    );

    const { caption } = req.body;

    const newImage = new GalleryImage({
      vendorId: req.params.vendorId,
      imageUrl: uploaded.url,
      key: uploaded.key,
      caption,
    });

    const saved = await newImage.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Create error:", err);
    res.status(400).json({ error: "Failed to create gallery image" });
  }
};

exports.insertMultipleGalleryImage = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0)
      return res.status(400).json({ error: "No images provided" });

    const uploadedResults = await Promise.all(
      files.map((file) =>
        uploadToS3(file.buffer, file.originalname, file.mimetype, S3_PREFIX)
      )
    );

    const images = uploadedResults.map((r, i) => ({
      vendorId: req.params.vendorId,
      imageUrl: r.url,
      key: r.key,
      caption: Array.isArray(req.body.captions)
        ? req.body.captions[i] || ""
        : "",
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
    const image = await GalleryImage.findOne({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!image)
      return res.status(404).json({ error: "Gallery image not found" });

    const { caption } = req.body;
    if (caption !== undefined) image.caption = caption;

    if (req.file) {
      // Delete old image if exists
      if (image.key) {
        try {
          await deleteFromS3(image.key);
          console.log("Old gallery image deleted:", image.key);
        } catch (err) {
          console.warn("Gallery image delete failed:", err.message);
        }
      }

      const uploaded = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        S3_PREFIX
      );
      image.imageUrl = uploaded.url;
      image.key = uploaded.key;
    }

    const updated = await image.save();
    res.json(updated);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Failed to update gallery image" });
  }
};

exports.deleteGalleryImage = async (req, res) => {
  try {
    const deleted = await GalleryImage.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!deleted)
      return res.status(404).json({ error: "Gallery image not found" });

    // Delete from S3 if key or URL exists
    const key = deleted.key || keyFromUrl(deleted.imageUrl);
    if (key) {
      try {
        await deleteFromS3(key);
        console.log("Gallery image deleted from S3:", key);
      } catch (err) {
        console.warn("S3 delete failed:", err.message);
      }
    }

    res.json({ message: "Gallery image deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete gallery image" });
  }
};
