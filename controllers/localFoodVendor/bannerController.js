const Banner = require("../../models/localFoodVendor/Banner");
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

exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ vendorId: req.params.vendorId });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch banners" });
  }
};

exports.createBanner = async (req, res) => {
  try {
    let imageUrl = null;
    let imageKey = null;

    if (req.file) {
      const uploaded = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        S3_PREFIX
      );
      imageUrl = uploaded.url;
      imageKey = uploaded.key;
    }

    const newBanner = new Banner({
      vendorId: req.params.vendorId,
      title: req.body.title,
      description: req.body.description,
      shape: req.body.shape || "fullscreen",
      image: imageUrl,
      key: imageKey || keyFromUrl(imageUrl),
    });
    const saved = await newBanner.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Create Banner Error:", err);
    // RETURN the error message so you can see it in tests
    res.status(400).json({
      error: "Failed to create banner",
      message: err.message,
      stack: err.stack,
    });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findOne({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!banner) return res.status(404).json({ error: "Banner not found" });

    // Text updates
    if (req.body.title !== undefined) banner.title = req.body.title;
    if (req.body.description !== undefined)
      banner.description = req.body.description;
    if (req.body.shape !== undefined) banner.shape = req.body.shape;

    // Image replacement + cleanup
    if (req.file) {
      // Delete old image from S3 if exists
      if (banner.key) {
        try {
          await deleteFromS3(banner.key);
          console.log("Old banner deleted:", banner.key);
        } catch (err) {
          console.warn("Old banner delete failed:", err.message);
        }
      }

      const uploaded = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        S3_PREFIX
      );
      banner.image = uploaded.url;
      banner.key = uploaded.key;
    }

    const updated = await banner.save();
    res.json(updated);
  } catch (err) {
    console.error("Update Banner Error:", err);
    res.status(500).json({ error: "Failed to update banner" });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const deleted = await Banner.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!deleted) return res.status(404).json({ error: "Banner not found" });

    // Delete associated S3 object if available
    const key = deleted.key || keyFromUrl(deleted.image);
    if (key) {
      try {
        await deleteFromS3(key);
        console.log("Banner image deleted from S3:", key);
      } catch (err) {
        console.warn("S3 delete failed:", err.message);
      }
    }

    res.json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete banner" });
  }
};
