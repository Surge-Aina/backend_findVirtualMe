const express = require("express");
const router = express.Router();
const UserData = require("../../models/healthcare/userData");
const verifyToken = require("../../middleware/auth");
const auth = require("../../middleware/auth");

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Healthcare API",
    timestamp: new Date().toISOString(),
  });
});

// Get public practice data by ID (ObjectId)
router.get("/practice/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Since we're using ObjectId everywhere, find by _id
    const userData = await UserData.findById(id);

    if (!userData || !userData.isActive) {
      return res.status(404).json({ error: "Practice not found" });
    }

    res.json(userData);
  } catch (error) {
    console.error("Error fetching practice data:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get practice by subdomain
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

// Get all public healthcare portfolios
router.get("/public/all", async (req, res) => {
  try {
    const publicHealthcarePortfolios = await UserData.find({
      isPublic: true,
      isActive: true,
    }).lean();

    // Add portfolioType field for frontend
    const portfoliosWithType = publicHealthcarePortfolios.map(portfolio => ({
      ...portfolio,
      portfolioType: 'Healthcare'
    }));

    res.json({
      success: true,
      portfolios: portfoliosWithType
    });
  } catch (error) {
    console.error("Error fetching public healthcare portfolios:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch public portfolios"
    });
  }
});

//Register new Practice
router.post("/auth/register", auth, async (req, res) => {
  try {
    const { email, password, firstName, lastName, practiceName } = req.body;
    const user = req.user;

    // Validation
    if (!email || !password || !firstName || !lastName || !practiceName) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    // Generate unique practice ID (kept for backward compatibility, but _id is primary)
    const practiceId = `practice_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create practice data
    const practiceData = new UserData({
      practiceId, // Keep for legacy/reference
      userId: user._id.toString(),
      practice: {
        name: `${user.firstName || 'Your'} ${user.lastName || 'Practice'}`,
        tagline: "Your Health, Our Priority",
        description: "Providing exceptional healthcare services with compassion and expertise.",
      },
      contact: {
        phone: user.phone || "",
        whatsapp: user.phone || "",
        email: user.email,
        address: {
          street: "",
          city: user.location || "",
          state: "",
          zip: "",
        },
      },
      hours: {
        weekdays: "Mon-Fri: 9:00 AM - 5:00 PM",
        saturday: "Sat: 9:00 AM - 2:00 PM",
        sunday: "Sun: Closed",
      },
      stats: {
        yearsExperience: "0",
        patientsServed: "0",
        successRate: "0",
        doctorsCount: "0",
      },
      services: [],
      blogPosts: [],
      gallery: {
        facilityImages: [],
        beforeAfterCases: [],
      },
      seo: {
        siteTitle: `${user.firstName || 'Healthcare'} - Professional Healthcare Services`,
        metaDescription: "Quality healthcare services tailored to your needs.",
        keywords: "healthcare, medical, clinic, doctor",
      },
      ui: {
        hero: {
          primaryButtonText: "Get Started",
          secondaryButtonText: "Learn More"
        },
        services: {
          viewAllText: "View All Services",
          bookButtonText: "Book Now"
        },
        blog: {
          readMoreText: "Read More",
          viewAllText: "View All Posts"
        },
        contact: {
          buttonText: "Contact Us",
          submitText: "Send Message"
        },
        cta: {
          heading: "Ready to Get Started?",
          description: "Contact us today to schedule your appointment",
          buttonText: "Schedule Appointment"
        },
        social: {
          facebook: "",
          instagram: "",
          twitter: "",
          linkedin: "",
          youtube: ""
        }
      }
    });

    await practiceData.save();

    res.status(201).json({
      success: true,
      message: "Practice registered successfully",
      practiceId,
      portfolio: practiceData,
    });
  } catch (error) {
    console.error("Error creating portfolio:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create portfolio",
      details: error.message,
    });
  }
});

// Get user's own healthcare portfolio(s)
router.get("/my-portfolios", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const portfolios = await UserData.find({ 
      userId: userId.toString() 
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      portfolios: portfolios.map(p => ({
        ...p.toObject(),
        practiceId: p._id.toString() // Ensure practiceId is the _id
      }))
    });
  } catch (error) {
    console.error("Error fetching user portfolios:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch portfolios"
    });
  }
});

// Get admin data for authenticated user's portfolio
router.get("/admin/data", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // Find user's healthcare portfolio
    const userData = await UserData.findOne({
      userId: userId.toString()
    });

    if (!userData) {
      return res.status(404).json({ 
        error: "Healthcare portfolio not found. Please create one first." 
      });
    }

    // Return data with practiceId set to _id
    res.json({
      ...userData.toObject(),
      practiceId: userData._id.toString()
    });
  } catch (error) {
    console.error("Error fetching admin data:", error);
    res.status(500).json({ 
      error: "Server error",
      details: error.message 
    });
  }
});

// Save/Update practice data (authenticated user only)
router.post("/admin/data", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const updateData = req.body;

    const updatedDocument = await UserData.findOneAndUpdate(
      { practiceId },
      {
        $set: updateData,
        lastModified: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedDocument) {
      return res.status(404).json({ 
        error: "Portfolio not found. Please create a portfolio first." 
      });
    }

    res.json({
      success: true,
      message: "Data saved successfully",
      timestamp: updatedDocument.lastModified,
    });
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save data",
      details: error.message,
    });
  }
});

// Update practice subdomain
router.post("/admin/subdomain", verifyToken, async (req, res) => {
  try {
    const { subdomain } = req.body;
    const userId = req.user.id || req.user._id;

    // Validate subdomain
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({
        error: "Invalid subdomain. Use only lowercase letters, numbers, and hyphens.",
      });
    }

    // Check if subdomain is taken by another user
    const existing = await UserData.findOne({
      subdomain: subdomain.toLowerCase(),
      userId: { $ne: userId.toString() },
    });

    if (existing) {
      return res.status(400).json({ error: "Subdomain already taken" });
    }

    // Update subdomain
    const updated = await UserData.findOneAndUpdate(
      { userId: userId.toString() },
      { subdomain: subdomain.toLowerCase() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ 
      success: true, 
      message: "Subdomain updated successfully",
      subdomain: subdomain.toLowerCase()
    });
  } catch (error) {
    console.error("Error updating subdomain:", error);
    res.status(500).json({ error: "Failed to update subdomain" });
  }
});

// Toggle portfolio public/private
router.post("/admin/toggle-public", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { isPublic } = req.body;

    const updated = await UserData.findOneAndUpdate(
      { userId: userId.toString() },
      { isPublic: !!isPublic },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ 
      success: true, 
      message: `Portfolio is now ${isPublic ? 'public' : 'private'}`,
      isPublic: updated.isPublic
    });
  } catch (error) {
    console.error("Error toggling public status:", error);
    res.status(500).json({ error: "Failed to update public status" });
  }
});

// Delete portfolio
router.delete("/admin/delete", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const deleted = await UserData.findOneAndDelete({
      userId: userId.toString()
    });

    if (!deleted) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ 
      success: true, 
      message: "Portfolio deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting portfolio:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to delete portfolio" 
    });
  }
});

// ==========================================
// INITIALIZATION (Demo Data)
// ==========================================

const initializeData = async () => {
  try {
    // Only create demo practice if no practices exist
    const count = await UserData.countDocuments();

    if (count === 0) {
      console.log("🏥 Creating demo practice...");

      // Create demo user
      const demoUser = new User({
        email: "demo@healthcare.com",
        password: await bcrypt.hash("demo123", 10),
        firstName: "Demo",
        lastName: "User",
        practiceId: "practice_demo",
        username: "demo",
        role: "admin",
      });
      await demoUser.save();

      // Create demo practice
      const demoData = new UserData({
        practiceId: "practice_demo",
        userId: demoUser._id.toString(),
        subdomain: "demo",
        portfolioName: "Demo Healthcare Portfolio",
        portfolioType: "Healthcare",
        isActive: true,
        isPublic: true, // Make demo public
        practice: {
          name: "Elite Medical Center",
          tagline: "Your Health, Our Priority",
          description:
            "Providing exceptional healthcare services with state-of-the-art technology and compassionate care.",
        },
        contact: {
          phone: "+1 (555) 123-4567",
          whatsapp: "+1 (555) 123-4567",
          email: "info@elitemedical.com",
          address: {
            street: "123 Healthcare Blvd, Suite 200",
            city: "Austin",
            state: "TX",
            zip: "78701",
          },
        },
        hours: {
          weekdays: "Mon-Fri: 8:00 AM - 6:00 PM",
          saturday: "Sat: 9:00 AM - 2:00 PM",
          sunday: "Sun: Closed",
        },
        stats: {
          yearsExperience: "15",
          patientsServed: "5,000",
          successRate: "98",
          doctorsCount: "8",
        },
        services: [
          {
            id: "primary-care",
            title: "Primary Care",
            description: "Comprehensive healthcare for all ages including checkups, preventive care, and chronic disease management.",
            icon: "user-md",
            price: "$150",
            duration: "45 minutes",
            features: [
              "Comprehensive health examination",
              "Preventive care screening",
              "Chronic disease management",
              "Health education and counseling"
            ]
          },
          {
            id: "urgent-care",
            title: "Urgent Care",
            description: "Immediate medical attention for non-life-threatening conditions.",
            icon: "heartbeat",
            price: "$200",
            duration: "30 minutes",
            features: [
              "Same-day appointments",
              "Minor injury treatment",
              "Illness diagnosis",
              "On-site lab testing"
            ]
          }
        ],
        blogPosts: [
          {
            id: 1,
            title: "10 Essential Health Tips for 2024",
            slug: "health-tips-2024",
            excerpt: "Discover the latest evidence-based strategies to maintain optimal health and prevent common illnesses.",
            content: "<h2>Introduction</h2><p>Maintaining good health requires a comprehensive approach...</p>",
            publishDate: "2024-03-15",
            author: { name: "Dr. Sarah Johnson", id: "dr-sarah" },
            category: "Health Tips",
            tags: ["health", "prevention", "wellness"],
            readTime: "5 min read",
            featured: true
          }
        ],
        gallery: {
          facilityImages: [],
          beforeAfterCases: [],
        },
        seo: {
          siteTitle: "Elite Medical Center - Healthcare Services",
          metaDescription: "Leading healthcare facility providing comprehensive medical services",
          keywords: "healthcare, medical, clinic, doctor, primary care",
        },
        ui: {
          hero: {
            primaryButtonText: "Get Started",
            secondaryButtonText: "Learn More"
          },
          services: {
            viewAllText: "View All Services",
            bookButtonText: "Book Appointment"
          },
          blog: {
            readMoreText: "Read More",
            viewAllText: "View All Articles"
          },
          contact: {
            buttonText: "Contact Us",
            submitText: "Send Message"
          },
          cta: {
            heading: "Ready to Get Started?",
            description: "Contact us today to schedule your appointment and take the first step toward better health.",
            buttonText: "Schedule Appointment"
          },
          social: {
            facebook: "",
            instagram: "",
            twitter: "",
            linkedin: "",
            youtube: ""
          }
        }
      });

      await demoData.save();

      console.log("✅ Demo healthcare practice created");
      console.log("📧 Demo login: demo@healthcare.com / demo123");
      console.log("🔗 Demo URL: /portfolios/healthcare/demo");
      console.log("🔗 Practice ID:", demoData._id.toString());
    } else {
      console.log("✅ Demo healthcare practice already exists");
    }
  } catch (error) {
    console.error("❌ Healthcare init error:", error);
  }
};

// Initialize on module load
initializeData();

module.exports = router;