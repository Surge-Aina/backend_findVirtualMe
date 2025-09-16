const SupportForm = require("../models/SupportForm");

// Create support form
exports.createSupportForm = async (req, res) => {
  try {
    const sf = new SupportForm(req.body);
    await sf.save();

    //seeding info
    //await seedVendor(vendor._id);

    res.status(201).json(sf);
  } catch (err) {
    res.status(400).json({ error: "Failed to create support form" });
  }
};