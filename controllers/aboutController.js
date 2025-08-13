const AboutContent = require("../models/About");

// controllers/aboutController.js
exports.getAllAbouts = async (req, res) => {
  try {
    const about = await AboutContent.findOne({});
    res.json(about);
    console.log("GET about id:", about?._id);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch about content" });
  }
};

exports.createAbout = async (req, res) => {
  try {
    const { title, description, shape, contentBlocks } = req.body;

    const bannerImage = req.files?.bannerImage?.[0]?.filename
      ? `/api/uploads/${req.files.bannerImage[0].filename}`
      : "";

    const gridImages =
      req.files?.gridImages?.map((f) => `/api/uploads/${f.filename}`) || [];

    const parsedBlocks =
      typeof contentBlocks === "string"
        ? JSON.parse(contentBlocks)
        : contentBlocks || [];

    // upsert the singleton doc instead of creating a new doc each time
    const updated = await AboutContent.findOneAndUpdate(
      {},
      {
        $set: {
          banner: { title, description, shape, image: bannerImage },
          contentBlocks: parsedBlocks,
        },
        $push: { gridImages: { $each: gridImages } },
      },
      { new: true, upsert: true }
    );

    return res.status(201).json(updated);
  } catch (err) {
    console.error("About section creation failed:", err);
    return res
      .status(500)
      .json({ error: "Server error creating about section" });
  }
};

exports.updateAbout = async (req, res) => {
  try {
    // Always operate on the singleton doc
    const about = (await AboutContent.findOne({})) ?? new AboutContent();

    // files → banner
    if (req.files?.bannerImage?.length) {
      about.banner = about.banner || {};
      about.banner.image = `/api/uploads/${req.files.bannerImage[0].filename}`;
    }

    // files → grid images (append & dedupe)
    if (req.files?.gridImages?.length) {
      const uploaded = req.files.gridImages.map(
        (f) => `/api/uploads/${f.filename}`
      );
      const current = Array.isArray(about.gridImages) ? about.gridImages : [];
      about.gridImages = Array.from(new Set([...current, ...uploaded]));
    }

    // banner text fields
    if (typeof req.body.title !== "undefined") {
      about.banner = about.banner || {};
      about.banner.title = req.body.title;
    }
    if (typeof req.body.description !== "undefined") {
      about.banner = about.banner || {};
      about.banner.description = req.body.description;
    }
    if (typeof req.body.shape !== "undefined") {
      about.banner = about.banner || {};
      about.banner.shape = req.body.shape;
    }

    // content blocks (string or object)
    if (typeof req.body.contentBlocks !== "undefined") {
      about.contentBlocks =
        typeof req.body.contentBlocks === "string"
          ? JSON.parse(req.body.contentBlocks)
          : req.body.contentBlocks;
    } else if (typeof req.body.blocks !== "undefined") {
      about.contentBlocks =
        typeof req.body.blocks === "string"
          ? JSON.parse(req.body.blocks)
          : req.body.blocks;
    }

    // grid images passed as JSON (from /upload-grid-images round‑trip)
    const bodyGrid =
      typeof req.body.gridImages !== "undefined"
        ? req.body.gridImages
        : typeof req.body.images !== "undefined"
        ? req.body.images
        : undefined;

    if (typeof bodyGrid !== "undefined") {
      const arr =
        typeof bodyGrid === "string" ? JSON.parse(bodyGrid) : bodyGrid;
      const incoming = Array.isArray(arr) ? arr : [arr];

      // ✅ REPLACE (preserve incoming order, de-dupe)
      const seen = new Set();
      about.gridImages = incoming.filter((u) => {
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });
    }

    const updated = await about.save();
    return res.json(updated);
  } catch (err) {
    console.error("Update About Error:", err);
    return res.status(500).json({ error: "Failed to update about section" });
  }
};

exports.deleteAbout = async (req, res) => {
  try {
    const deleted = await AboutContent.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "About content not found" });
    res.json({ message: "About content deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete about content" });
  }
};

exports.imageUpload = async (req, res) => {
  try {
    const urls = req.files.map((file) => `/api/uploads/${file.filename}`);
    res.json({ urls });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Failed to upload images" });
  }
};
