const express = require("express");
const router = express.Router();
const {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getFullPortfolio,
} = require("../controllers/localVendorController");

router.post("/", createVendor);
router.get("/", getAllVendors);
router.get("/:vendorId", getVendorById);
router.put("/:vendorId", updateVendor);
router.delete("/:vendorId", deleteVendor);

// Special endpoint → returns vendor + all linked sections
router.get("/:vendorId/full", getFullPortfolio);

module.exports = router;
