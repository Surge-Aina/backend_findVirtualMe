const express = require("express");
const router = express.Router();
const {
  getAllReviews,
  createReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");

router.get("/:vendorId", getAllReviews);
router.post("/:vendorId", createReview);
router.put("/:vendorId/:id", updateReview);
router.delete("/:vendorId/:id", deleteReview);

module.exports = router;
