const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  getPortfolioByEmail,
  getAllPortfoliosByEmail,
  addPortfolio,
  addPDF,
  deletePortfolioByEmail,
  editPortfolioByEmail,
  getPortfolioById,
  aiSummary,
  getAllPortfolios,
} = require("../../controllers/projectManager/portfolioController");
const auth = require("../../middleware/auth");

const upload = multer({ storage: multer.memoryStorage() });
router.get("/email/:email", getPortfolioByEmail);
router.get("/all-porfolios-by-email/:email", getAllPortfoliosByEmail);
router.get("/id/:id", getPortfolioById);
router.get("/all-portfolios", getAllPortfolios);

router.post("/add", addPortfolio);
router.post("/upload-pdf", upload.single("resume"), addPDF);
router.post("/ai-summary", aiSummary);

router.patch("/edit", auth, editPortfolioByEmail);

router.delete("/delete", deletePortfolioByEmail);

module.exports = router;
