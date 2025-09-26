const MenuItem = require("../../models/localFoodVendor/MenuItems");

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
  //console.log("Incoming Form Data:", req.body);
  const { name, price, category, description, isAvailable, unavailableUntil } =
    req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : "";

  try {
    const menuItem = new MenuItem({
      vendorId: req.params.vendorId,
      name,
      price,
      category,
      description,
      isAvailable: isAvailable ?? true,
      unavailableUntil: unavailableUntil || null,
      image,
    });
    await menuItem.save();
    res.status(201).json(menuItem);
  } catch (err) {
    console.error("Create menu item error:", err);
    res.status(400).json({ error: "Failed to create menu item" });
  }
};

exports.updateMenuItem = async (req, res) => {
  const updateData = { ...req.body };

  if (req.file) {
    updateData.image = `/uploads/${req.file.filename}`;
  }

  try {
    const updated = await MenuItem.findByIdAndUpdate(
      { _id: req.params.id, vendorId: req.params.vendorId },
      updateData,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Menu item not found" });
    res.json(updated);
  } catch (err) {
    console.error("Update failed:", err);
    res.status(400).json({ error: "Failed to update menu item" });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const deleted = await MenuItem.findByIdAndDelete({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting item" });
  }
};
