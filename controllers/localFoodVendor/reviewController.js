const Review = require("../../models/localFoodVendor/Review");

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ vendorId: req.params.vendorId });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
};

exports.createReview = async (req, res) => {
  try {
    const newReview = new Review({
      vendorId: req.params.vendorId,
      ...req.body,
    });
    const saved = await newReview.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: "Failed to create review" });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const updated = await Review.findByIdAndUpdate(
      { _id: req.params.id, vendorId: req.params.vendorId },
      req.body,
      {
        new: true,
      }
    );
    if (!updated) return res.status(404).json({ error: "Review not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update review" });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const deleted = await Review.findByIdAndDelete({
      _id: req.params.id,
      vendorId: req.params.vendorId,
    });
    if (!deleted) return res.status(404).json({ error: "Review not found" });
    res.json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete review" });
  }
};
