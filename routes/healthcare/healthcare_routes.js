const express = require("express");
const router = express.Router();
const UserData = require("../../models/healthcare/userData");
const User = require("../../models/User");
const verifyToken = require("../../middleware/auth");

// ==========================================
// PUBLIC ROUTES (No Auth Required)
// ==========================================

router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Healthcare API",
    timestamp: new Date().toISOString(),
  });
});

// Get practice data by _id (primary) or legacy practiceId (fallback)
router.get("/practice/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Try _id first (standard approach like other portfolios)
    let userData = await UserData.findOne({ _id: id, isActive: true });

    // Fallback: legacy practiceId
    if (!userData) {
      userData = await UserData.findOne({ practiceId: id, isActive: true });
    }

    if (!userData) {
      return res.status(404).json({ error: "Practice not found" });
    }

    res.json(userData);
  } catch (error) {
    console.error("Error fetching practice data:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/subdomain/:subdomain", async (req, res) => {
  try {
    const { subdomain } = req.params;
    const userData = await UserData.findOne({
      subdomain: subdomain.toLowerCase(),
      isActive: true,
    });

    if (!userData) {
      return res.status(404).json({ error: "Practice not found" });
    }

    res.json(userData);
  } catch (error) {
    console.error("Error fetching practice by subdomain:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/public/all", async (req, res) => {
  try {
    const portfolios = await UserData.find({ isPublic: true, isActive: true }).lean();

    res.json({
      success: true,
      portfolios: portfolios.map(p => ({ ...p, portfolioType: 'Healthcare' }))
    });
  } catch (error) {
    console.error("Error fetching public portfolios:", error);
    res.status(500).json({ success: false, error: "Failed to fetch public portfolios" });
  }
});

router.get("/demo", async (req, res) => {
  try {
    const demoData = await UserData.findOne({ practiceId: "practice_demo", isActive: true });

    if (!demoData) {
      return res.status(404).json({ error: "Demo practice not found" });
    }

    res.json(demoData);
  } catch (error) {
    console.error("Error fetching demo data:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Unified route for Dashboard (same pattern as other portfolios - uses _id)
router.get("/publicPortfolios/Healthcare/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const portfolio = await UserData.findById(id);
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ ...portfolio.toObject(), portfolioType: 'Healthcare' });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// PROTECTED ROUTES
// ==========================================

router.post("/create", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const existingCount = await UserData.countDocuments({ userId: userId.toString() });

    // Generate unique subdomain
    const baseSubdomain = (user.username || user.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '');
    let subdomain = baseSubdomain;
    let counter = existingCount + 1;

    while (await UserData.findOne({ subdomain })) {
      subdomain = `${baseSubdomain}${counter}`;
      counter++;
    }

    // ✅ Create portfolio - MongoDB _id is the identifier (NO practiceId)
    const newPortfolio = new UserData({
      userId: userId.toString(),
      subdomain,
      portfolioName: `${user.firstName || 'My'} ${user.lastName || ''} Healthcare Portfolio${existingCount > 0 ? ` #${existingCount + 1}` : ''}`.trim(),
      portfolioType: "Healthcare",
      isActive: true,
      isPublic: false,
      practice: {
        name: `${user.firstName || 'Your'} ${user.lastName || 'Practice'}`,
        tagline: "Your Health, Our Priority",
        description: "Providing exceptional healthcare services with compassion and expertise.",
      },
      contact: {
        phone: user.phone || "",
        whatsapp: user.phone || "",
        email: user.email,
        address: { street: "", city: user.location || "", state: "", zip: "" },
      },
      hours: {
        weekdays: "Mon-Fri: 9:00 AM - 5:00 PM",
        saturday: "Sat: 9:00 AM - 2:00 PM",
        sunday: "Sun: Closed",
      },
      stats: { yearsExperience: "0", patientsServed: "0", successRate: "0", doctorsCount: "1" },
      services: [],
      blogPosts: [],
      gallery: { facilityImages: [], beforeAfterCases: [] },
      seo: {
        siteTitle: `${user.firstName || 'Healthcare'} - Professional Healthcare Services`,
        metaDescription: "Quality healthcare services tailored to your needs.",
        keywords: "healthcare, medical, clinic, doctor",
      },
      ui: {
        hero: { primaryButtonText: "Get Started", secondaryButtonText: "Learn More" },
        services: { viewAllText: "View All Services", bookButtonText: "Book Now" },
        blog: { readMoreText: "Read More", viewAllText: "View All Posts" },
        contact: { buttonText: "Contact Us", submitText: "Send Message" },
        cta: { heading: "Ready to Get Started?", description: "Contact us today to schedule your appointment", buttonText: "Schedule Appointment" },
        social: { facebook: "", instagram: "", twitter: "", linkedin: "", youtube: "" }
      }
    });

    await newPortfolio.save();

    console.log(`✅ Created healthcare portfolio: ${newPortfolio._id}`);

    // ✅ Return _id as practiceId for backward compatibility with frontend
    res.status(201).json({
      success: true,
      message: "Healthcare portfolio created successfully",
      practiceId: newPortfolio._id.toString(),
      _id: newPortfolio._id.toString(),
      subdomain,
      portfolio: newPortfolio
    });

  } catch (error) {
    console.error("Error creating healthcare portfolio:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Portfolio identifier conflict. Please try again." });
    }
    res.status(500).json({ error: "Failed to create healthcare portfolio" });
  }
});

router.get("/my-portfolios", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const portfolios = await UserData.find({ userId: userId.toString(), isActive: true }).lean();

    res.json({
      success: true,
      portfolios: portfolios.map(p => ({ ...p, portfolioType: 'Healthcare' }))
    });
  } catch (error) {
    console.error("Error fetching user portfolios:", error);
    res.status(500).json({ error: "Failed to fetch portfolios" });
  }
});

// ✅ Get admin data by _id
router.get("/admin/data/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const userData = await UserData.findOne({ _id: id, userId: userId.toString(), isActive: true });

    if (!userData) {
      return res.status(404).json({ error: "Portfolio not found or unauthorized" });
    }

    res.json(userData);
  } catch (error) {
    console.error("Error fetching admin data:", error);
    res.status(500).json({ error: "Failed to fetch admin data" });
  }
});

// Legacy endpoint
router.get("/admin/data", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userData = await UserData.findOne({ userId: userId.toString(), isActive: true });

    if (!userData) {
      return res.status(404).json({ error: "No healthcare portfolio found" });
    }

    res.json(userData);
  } catch (error) {
    console.error("Error fetching admin data:", error);
    res.status(500).json({ error: "Failed to fetch admin data" });
  }
});

// ✅ Save admin data by _id
router.post("/admin/data/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const updateData = req.body;

    const existing = await UserData.findOne({ _id: id, userId: userId.toString() });
    if (!existing) {
      return res.status(404).json({ error: "Portfolio not found or unauthorized" });
    }

    delete updateData._id;
    delete updateData.userId;
    delete updateData.createdAt;

    const updated = await UserData.findByIdAndUpdate(id, { ...updateData, lastModified: new Date() }, { new: true });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error saving admin data:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
});

// Legacy save
router.post("/admin/data", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const updateData = req.body;

    delete updateData._id;
    delete updateData.userId;
    delete updateData.createdAt;

    const updated = await UserData.findOneAndUpdate(
      { userId: userId.toString(), isActive: true },
      { ...updateData, lastModified: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error saving admin data:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
});

router.post("/admin/subdomain/:id", verifyToken, async (req, res) => {
  try {
    const { subdomain } = req.body;
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({ error: "Invalid subdomain format" });
    }

    const existing = await UserData.findOne({ subdomain: subdomain.toLowerCase(), _id: { $ne: id } });
    if (existing) {
      return res.status(400).json({ error: "Subdomain already taken" });
    }

    const updated = await UserData.findOneAndUpdate(
      { _id: id, userId: userId.toString() },
      { subdomain: subdomain.toLowerCase() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Portfolio not found or unauthorized" });
    }

    res.json({ success: true, subdomain: subdomain.toLowerCase() });
  } catch (error) {
    console.error("Error updating subdomain:", error);
    res.status(500).json({ error: "Failed to update subdomain" });
  }
});

router.post("/admin/toggle-public/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const { isPublic } = req.body;

    const updated = await UserData.findOneAndUpdate(
      { _id: id, userId: userId.toString() },
      { isPublic: !!isPublic },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Portfolio not found or unauthorized" });
    }

    res.json({ success: true, isPublic: updated.isPublic });
  } catch (error) {
    console.error("Error toggling public status:", error);
    res.status(500).json({ error: "Failed to update public status" });
  }
});

router.delete("/admin/delete/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const deleted = await UserData.findOneAndDelete({ _id: id, userId: userId.toString() });

    if (!deleted) {
      return res.status(404).json({ error: "Portfolio not found or unauthorized" });
    }

    res.json({ success: true, message: "Portfolio deleted successfully" });
  } catch (error) {
    console.error("Error deleting portfolio:", error);
    res.status(500).json({ error: "Failed to delete portfolio" });
  }
});

// Demo data initialization
const initializeData = async () => {
  try {
    const demoExists = await UserData.findOne({ practiceId: "practice_demo" });
    if (!demoExists) {
      console.log("🏥 Creating demo healthcare practice...");

      let demoUser = await User.findOne({ email: "demo@healthcare.com" });
      if (!demoUser) {
        const bcrypt = require("bcryptjs");
        demoUser = new User({
          email: "demo@healthcare.com",
          password: await bcrypt.hash("demo123", 10),
          firstName: "Demo",
          lastName: "Practice",
          username: "demo-healthcare",
          role: "user",
        });
        await demoUser.save();
      }

      const demoData = new UserData({
        practiceId: "practice_demo",
        userId: demoUser._id.toString(),
        subdomain: "demo",
        portfolioName: "Demo Healthcare Portfolio",
        portfolioType: "Healthcare",
        isActive: true,
        isPublic: true,
        practice: { name: "Elite Medical Center", tagline: "Your Health, Our Priority", description: "Providing exceptional healthcare services." },
        contact: { phone: "+1 (555) 123-4567", whatsapp: "+1 (555) 123-4567", email: "info@elitemedical.com", address: { street: "123 Healthcare Blvd", city: "Austin", state: "TX", zip: "78701" } },
        hours: { weekdays: "Mon-Fri: 8:00 AM - 6:00 PM", saturday: "Sat: 9:00 AM - 2:00 PM", sunday: "Sun: Closed" },
        stats: { yearsExperience: "15", patientsServed: "5,000", successRate: "98", doctorsCount: "8" },
        services: [{ id: "primary-care", title: "Primary Care", description: "Comprehensive healthcare.", icon: "user-md", price: "$150", duration: "45 minutes", features: ["Health examination", "Preventive care"] }],
        blogPosts: [],
        gallery: { facilityImages: [], beforeAfterCases: [] },
        seo: { siteTitle: "Elite Medical Center", metaDescription: "Leading healthcare facility", keywords: "healthcare, medical, clinic" },
        ui: { hero: { primaryButtonText: "Get Started", secondaryButtonText: "Learn More" }, services: { viewAllText: "View All", bookButtonText: "Book Now" }, blog: { readMoreText: "Read More", viewAllText: "View All" }, contact: { buttonText: "Contact Us", submitText: "Send" }, cta: { heading: "Ready?", description: "Contact us today.", buttonText: "Schedule" }, social: { facebook: "", instagram: "", twitter: "", linkedin: "", youtube: "" } }
      });

      await demoData.save();
      console.log("✅ Demo healthcare practice created");
    }
  } catch (error) {
    console.error("❌ Healthcare init error:", error);
  }
};

initializeData();

module.exports = router;