const LocalVendorPortfolio = require("../models/LocalVendorPortfolio");
const Banner = require("../models/Banner");
const About = require("../models/About");
const GalleryImage = require("../models/GalleryImage");
const MenuItem = require("../models/MenuItems");
const Review = require("../models/Review");
const TaggedImage = require("../models/TaggedImage");
const seedVendor = require("../models/seedVendor");

// Create vendor
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
