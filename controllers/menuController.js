const MenuItem = require("../models/MenuItems");

exports.getMenuItems = async (req, res) => {
  try {
    const { category } = req.query;

    const filter = category && category !== "All" ? { category } : {};
    const items = await MenuItem.find(filter);

    res.json(items);
  } catch (err) {
    console.error("Error fetching menu items:", err);
    res.status(500).json({ error: "Server error fetching menu items" });
  }
};

exports.getUniqueCategories = async (req, res) => {
  try {
    const categories = await MenuItem.distinct("category");
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
  // const { name, description, category, price } = req.body;
  // const updateData = {
  //   name: req.body.name,
  //   description: req.body.description,
  //   price: req.body.price,
  //   category: req.body.category,

  // };
  const updateData = { ...req.body };

  if (req.file) {
    updateData.image = `/uploads/${req.file.filename}`;
  }

  try {
    const updated = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    res.status(200).json(updated);
  } catch (err) {
    console.error("Update failed:", err);
    res.status(400).json({ error: "Failed to update menu item" });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const deleted = await MenuItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting item" });
  }
};
