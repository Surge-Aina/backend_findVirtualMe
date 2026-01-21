//

const express = require("express");
const router = express.Router();
const cleaningController = require("../../controllers/cleaningLady/portfolioController");
const projectManagerController = require("../../controllers/projectManager/portfolioController");
const authenticate = require("../../middleware/auth");

// ============================================
// PUBLIC ROUTES (No authentication needed)
// ============================================

// Get all portfolios (uses projectManager controller)
// router.get('/all-portfolios', projectManagerController.getAllPortfolios);
router.get("/all-portfolios", cleaningController.getAllPortfolios);

// View a portfolio by slug (uses cleaning controller)
router.get("/public/:slug", cleaningController.getPublicPortfolio);

// ============================================
// PROTECTED ROUTES (Require FindVirtualMe login)
// ============================================

router.get("/me-user", authenticate, async (req, res) => {
  try {
    const User = require("../../models/User");
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get my portfolio
router.get("/my-portfolio", authenticate, cleaningController.getMyPortfolio);

// Create or update my portfolio
router.post("/my-portfolio", authenticate, cleaningController.savePortfolio);

//create new portfolio
router.post("/new-portfolio", authenticate, cleaningController.newPortfolio);

// Publish portfolio
router.post("/my-portfolio/publish", authenticate, cleaningController.publishPortfolio);

// Update portfolio
router.patch("/my-portfolio", authenticate, cleaningController.updateMyPortfolio);

// Unpublish portfolio
router.post(
  "/my-portfolio/unpublish",
  authenticate,
  cleaningController.unpublishPortfolio
);

// ===== Services =====
router.post("/my-portfolio/services", authenticate, cleaningController.addService);
router.put(
  "/my-portfolio/services/:serviceId",
  authenticate,
  cleaningController.updateService
);
router.delete(
  "/my-portfolio/services/:serviceId",
  authenticate,
  cleaningController.deleteService
);

// ===== Room Pricing =====
router.put(
  "/my-portfolio/room-pricing",
  authenticate,
  cleaningController.updateRoomPricing
);

// Get portfolio by ID (MUST be last to avoid conflicts)
router.get("/:portfolioId", cleaningController.getPortfolioById);

// ✅ Submit a quote (PUBLIC - no auth needed)
router.post("/quotes", cleaningController.submitQuote);
// ✅ ===== Quotes Management =====
// Get my quotes (admin/owner only)
router.get("/my-portfolio/quotes", authenticate, cleaningController.getMyQuotes);

// Update quote status (admin/owner only)
router.patch(
  "/quotes/:quoteId/status",
  authenticate,
  cleaningController.updateQuoteStatus
);

// Get portfolio by ID (MUST be last to avoid conflicts)
router.get("/:portfolioId", cleaningController.getPortfolioById);
module.exports = router;
