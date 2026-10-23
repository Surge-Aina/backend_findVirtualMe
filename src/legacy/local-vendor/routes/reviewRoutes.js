const express = require("express");
const router = express.Router();
const {
  getAllReviews,
  createReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");
const { vendorWrite } = require("../../legacyWriteGuard");

router.get("/:vendorId", getAllReviews);
router.post("/:vendorId", createReview);
router.put("/:vendorId/:id", ...vendorWrite, updateReview);
router.delete("/:vendorId/:id", ...vendorWrite, deleteReview);

module.exports = router;
