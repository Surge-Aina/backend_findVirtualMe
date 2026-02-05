// controllers/localFoodVendor/aboutController.js
const AboutContent = require("../../models/localFoodVendor/About");
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

exports.getAllAbouts = async (req, res) => {
  try {
    const about = await AboutContent.findOne({ vendorId: req.params.vendorId });
    //res.json(about);
    if (!about) {
      // No record found, proper REST response
      return res.status(404).json({ error: "About content not found" });
    }
    console.log("GET about id:", about?._id);
    return res.status(200).json(about);
  } catch (err) {
    console.error("GET About Error:", err);
    res.status(500).json({ error: "Failed to fetch about content" });
  }
};

exports.createAbout = async (req, res) => {
  try {
    const { title, description, shape, contentBlocks } = req.body;

    let bannerImageUrl = "";
    let bannerImageKey = "";
    let gridImages = [];

    // Upload banner image to S3 if provided
    if (req.files?.bannerImage?.[0]) {
      const r = await uploadToS3(
        req.files.bannerImage[0].buffer,
        req.files.bannerImage[0].originalname,
        req.files.bannerImage[0].mimetype,
        S3_PREFIX
      );
      bannerImageUrl = r.url;
      bannerImageKey = r.key;
    }

    // Upload grid images to S3 if provided
    if (req.files?.gridImages?.length) {
      const uploadResults = await Promise.all(
        req.files.gridImages.map((f) =>
          uploadToS3(f.buffer, f.originalname, f.mimetype, S3_PREFIX)
        )
      );
      gridImages = uploadResults.map((r) => r.url);
    }

    const parsedBlocks =
      typeof contentBlocks === "string"
        ? JSON.parse(contentBlocks)
        : contentBlocks || [];

    // upsert
    const updated = await AboutContent.findOneAndUpdate(
      { vendorId: req.params.vendorId },
      {
        $set: {
          vendorId: req.params.vendorId,
          banner: {
            title,
            description,
            shape,
            image: bannerImageUrl,
            key: bannerImageKey || keyFromUrl(bannerImageUrl),
          },
          contentBlocks: parsedBlocks,
        },
        $push: { gridImages: { $each: gridImages } },
      },
      { new: true, upsert: true }
    );

    res.status(201).json(updated);
  } catch (err) {
    console.error("About section creation failed:", err);
    res.status(500).json({ error: "Server error creating about section" });
  }
};

exports.updateAbout = async (req, res) => {
  try {
    let about =
      (await AboutContent.findOne({ vendorId: req.params.vendorId })) ??
      new AboutContent({ vendorId: req.params.vendorId });

    // Upload banner image if provided
    if (req.files?.bannerImage?.[0]) {
      const r = await uploadToS3(
        req.files.bannerImage[0].buffer,
        req.files.bannerImage[0].originalname,
        req.files.bannerImage[0].mimetype,
        S3_PREFIX
      );
      about.banner = about.banner || {};
      about.banner.image = r.url;
      about.banner.key = r.key;
    }

    // Upload grid images if provided (append)
    if (req.files?.gridImages?.length) {
      const uploadResults = await Promise.all(
        req.files.gridImages.map((f) =>
          uploadToS3(f.buffer, f.originalname, f.mimetype, S3_PREFIX)
        )
      );
      const uploadedUrls = uploadResults.map((r) => r.url);
      const current = Array.isArray(about.gridImages) ? about.gridImages : [];
      about.gridImages = Array.from(new Set([...current, ...uploadedUrls]));
    }

    // banner text
    ["title", "description", "shape"].forEach((key) => {
      if (req.body[key] !== undefined) {
        about.banner = about.banner || {};
        about.banner[key] = req.body[key];
      }
    });

    // content blocks
    if (req.body.contentBlocks) {
      about.contentBlocks =
        typeof req.body.contentBlocks === "string"
          ? JSON.parse(req.body.contentBlocks)
          : req.body.contentBlocks;
    } else if (req.body.blocks) {
      about.contentBlocks =
        typeof req.body.blocks === "string"
          ? JSON.parse(req.body.blocks)
          : req.body.blocks;
    }

    // grid images passed as JSON (manual reorder/delete)
    if (req.body.gridImages || req.body.images) {
      const bodyGrid = req.body.gridImages || req.body.images;
      const arr =
        typeof bodyGrid === "string" ? JSON.parse(bodyGrid) : bodyGrid;
      const incoming = Array.isArray(arr) ? arr : [arr];
      const seen = new Set();
      about.gridImages = incoming.filter((u) => {
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });
    }

    const updated = await about.save();
    res.json(updated);
  } catch (err) {
    console.error("Update About Error:", err);
    res.status(500).json({ error: "Failed to update about section" });
  }
};

exports.deleteAbout = async (req, res) => {
  try {
    const deleted = await AboutContent.findByIdAndDelete({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!deleted)
      return res.status(404).json({ error: "About content not found" });

    // Optional: clean up S3 files if keys stored
    if (deleted.banner?.key) await deleteFromS3(deleted.banner.key);
    if (Array.isArray(deleted.gridImages)) {
      for (const url of deleted.gridImages) {
        const k = keyFromUrl(url);
        if (k) await deleteFromS3(k);
      }
    }

    res.json({ message: "About content deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete about content" });
  }
};

// Upload-only endpoint for async uploads
exports.imageUpload = async (req, res) => {
  try {
    const uploaded = await Promise.all(
      req.files.map((f) =>
        uploadToS3(f.buffer, f.originalname, f.mimetype, S3_PREFIX)
      )
    );
    const urls = uploaded.map((r) => r.url);
    res.json({ urls });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Failed to upload images" });
  }
};
