const LocalVendorPortfolio = require("../../models/localFoodVendor/LocalVendorPortfolio");
const Banner = require("../../models/localFoodVendor/Banner");
const About = require("../../models/localFoodVendor/About");
const GalleryImage = require("../../models/localFoodVendor/GalleryImage");
const MenuItem = require("../../models/localFoodVendor/MenuItems");
const Review = require("../../models/localFoodVendor/Review");
const TaggedImage = require("../../models/localFoodVendor/TaggedImage");
const seedVendor = require("../../models/localFoodVendor/seedVendor");
const { generateVendorAboutAndMenuJSON } = require("../../services/openAiService");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

// Create vendor and add the basic info so website doesn't look blank, view seedVendor
exports.createVendor = async (req, res) => {
  try {
    const vendor = new LocalVendorPortfolio(req.body);
    await vendor.save();

    //seeding info
    await seedVendor(vendor._id);

    res.status(201).json(vendor);
  } catch (err) {
    res.status(400).json({ error: "Failed to create vendor" });
  }
};

// Get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await LocalVendorPortfolio.find();
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
};

// Get one vendor
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await LocalVendorPortfolio.findById(req.params.vendorId);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vendor" });
  }
};

// Update vendor
exports.updateVendor = async (req, res) => {
  try {
    const updated = await LocalVendorPortfolio.findByIdAndUpdate(
      req.params.vendorId,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Vendor not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update vendor" });
  }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
  try {
    const deleted = await LocalVendorPortfolio.findByIdAndDelete(
      req.params.vendorId
    );
    if (!deleted) return res.status(404).json({ error: "Vendor not found" });
    res.json({ message: "Vendor deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete vendor" });
  }
};

// Aggregated portfolio data
exports.getFullPortfolio = async (req, res) => {
  try {
    const vendorId = req.params.vendorId;
    const vendor = await LocalVendorPortfolio.findById(vendorId);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });

    // fetch all linked data in parallel
    const [banners, about, gallery, menu, reviews, taggedImages] =
      await Promise.all([
        Banner.find({ vendorId }),
        About.findOne({ vendorId }),
        GalleryImage.find({ vendorId }),
        MenuItem.find({ vendorId }),
        Review.find({ vendorId }),
        TaggedImage.find({ vendorId }).populate("tags.menuItem"),
      ]);

    res.json({ vendor, banners, about, gallery, menu, reviews, taggedImages });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch full portfolio" });
  }
};

async function extractText(fileBuffer, mimeType) {
  if (mimeType === "application/pdf") {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } else {
    const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
    return value;
  }
}

// NEW: Inject vendor + about + menu
exports.injectVendorPortfolio = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File is required" });

    const text = await extractText(req.file.buffer, req.file.mimetype);
    let parsed;
    try {
      parsed = await generateVendorAboutAndMenuJSON(text);
    } catch (err) {
      console.error("OpenAI JSON parse failed:", err.message);
      return res.status(400).json({
        error:
          "Could not convert the document into valid vendor data. Please check formatting.",
      });
    }

    if (
      !parsed.vendor ||
      !parsed.vendor.name ||
      !parsed.vendor.email ||
      !parsed.vendor.phone
    ) {
      return res.status(400).json({
        error:
          "Vendor profile is missing required fields (name, email, phone). Please upload a document with complete vendor details",
      });
    }

    const existing = await LocalVendorPortfolio.findOne({
      email: parsed.vendor.email,
    });
    if (existing) {
      return res.status(400).json({
        error: `Vendor with email ${parsed.vendor.email} already exists.`,
      });
    }

    const vendor = await LocalVendorPortfolio.create(parsed.vendor);

    await About.create({ ...parsed.about, vendorId: vendor._id });

    if (parsed.menuItems && parsed.menuItems.length > 0) {
      const menuDocs = parsed.menuItems.map((m) => ({
        ...m,
        vendorId: vendor._id,
      }));
      await MenuItem.insertMany(menuDocs);
    }

    await Banner.create({
      vendorId: vendor._id,
      title: "Welcome to " + (vendor.name || "Our Business"),
      description: vendor.description || "Your banner description here.",
      image: "https://placehold.co/1200x400", // placeholder
      shape: "fullscreen",
    });

    res
      .status(201)
      .json({ vendor, about: parsed.about, menuItems: parsed.menuItems });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to create vendor portfolio from document" });
  }
};
