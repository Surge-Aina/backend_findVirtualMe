const MenuItem = require("../../models/localFoodVendor/MenuItems");
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

exports.getMenuItems = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { vendorId: req.params.vendorId };
    if (category && category !== "All") filter.category = category;
    const items = await MenuItem.find(filter);
    res.json(items);
  } catch (err) {
    console.error("Error fetching menu items:", err);
    res.status(500).json({ error: "Server error fetching menu items" });
  }
};

exports.getUniqueCategories = async (req, res) => {
  try {
    const categories = await MenuItem.distinct("category", {
      vendorId: req.params.vendorId,
    });
    res.json(["All", ...categories]);
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    res.status(500).json({ error: "Failed to get categories" });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    let imageUrl = "";
    let imageKey = "";

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

    const menuItem = new MenuItem({
      vendorId: req.params.vendorId,
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      description: req.body.description,
      isAvailable:
        typeof req.body.isAvailable !== "undefined"
          ? req.body.isAvailable
          : true,
      unavailableUntil: req.body.unavailableUntil || null,
      imageUrl, // ✅ match schema field
      imageKey: imageKey || keyFromUrl(imageUrl),
    });

    console.log("Saving new menu item with:", { imageUrl, imageKey });
    const saved = await menuItem.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Create menu item error:", err);
    res.status(400).json({ error: "Failed to create menu item" });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findOne({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!item) return res.status(404).json({ error: "Menu item not found" });

    // Replace image (with S3 cleanup)
    if (req.file) {
      if (item.imageKey) {
        try {
          await deleteFromS3(item.imageKey);
        } catch (e) {
          console.warn("S3 delete (old menu image) failed:", e?.message);
        }
      }

      const uploaded = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        S3_PREFIX
      );
      item.imageUrl = uploaded.url; // ✅ match schema field
      item.imageKey = uploaded.key;
    }

    // Partial updates for other fields
    if (typeof req.body.name !== "undefined") item.name = req.body.name;
    if (typeof req.body.price !== "undefined") item.price = req.body.price;
    if (typeof req.body.category !== "undefined")
      item.category = req.body.category;
    if (typeof req.body.description !== "undefined")
      item.description = req.body.description;
    if (typeof req.body.isAvailable !== "undefined")
      item.isAvailable = req.body.isAvailable;
    if (typeof req.body.unavailableUntil !== "undefined")
      item.unavailableUntil = req.body.unavailableUntil;

    console.log("Saving updated menu item with:", {
      imageUrl: item.imageUrl,
      imageKey: item.imageKey,
    });

    const updated = await item.save();
    res.json(updated);
  } catch (err) {
    console.error("Update failed:", err);
    res.status(400).json({ error: "Failed to update menu item" });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const deleted = await MenuItem.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!deleted) return res.status(404).json({ error: "Item not found" });

    const key = deleted.imageKey || keyFromUrl(deleted.imageUrl);
    if (key) {
      try {
        await deleteFromS3(key);
      } catch (e) {
        console.warn("S3 delete (menu) failed:", e?.message);
      }
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).json({ error: "Error deleting item" });
  }
};
