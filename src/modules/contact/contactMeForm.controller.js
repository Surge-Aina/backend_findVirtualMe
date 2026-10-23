// contactMeForm.service.js
// const ProjectManagerContact = require("../../models/projectManager/ProjectManagerContact");
// const Portfolio = require("../../models/projectManager/portfolioModel");
const { sendGenericContactEmails } = require("../../shared/services/emailService");
const contactMeFormDB = require("./contactMeForm.model");
const portfolioService = require("../portfolios/portfolio.service");
const User = require("../../shared/models/User");

exports.submitContact = async (req, res) => {
  try {
    const { name, email, message, portfolioId, portfolioType } = req.body;
    let { ownerEmail, ownerName } = req.body;

    if (portfolioId && (!ownerEmail || !ownerName)) {
      const portfolio = await portfolioService.getPortfolio(portfolioId);
      if (portfolio?.owner) {
        const owner = await User.findById(portfolio.owner)
          .select("email name username")
          .lean();
        ownerEmail = ownerEmail || owner?.email;
        ownerName = ownerName || owner?.name || owner?.username;
      }
    }

    // Validation
    if (!name || !email || !message || !portfolioId || !ownerEmail || !ownerName) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, message, portfolioId, ownerEmail, and ownerName are required",
      });
    }

    // Save contact to database
    const contact = await contactMeFormDB.create({
      portfolioId,
      portfolioType,
      ownerEmail,
      ownerName,
      name,
      email,
      message,
      status: "new",
    });

    console.log("✅ Contact saved to database:", contact._id);

    // Prepare form data for emails
    const formData = {
      name,
      email,
      message,
      portfolioType,
    };

    // Send emails (non-blocking)
    sendGenericContactEmails(formData, ownerEmail, ownerName)
      .then(() => {
        console.log("✅ Contact emails sent successfully");
      })
      .catch((error) => {
        console.error("❌ Error sending contact emails:", error.message);
        // Don't fail the request if emails fail
      });

    // Respond immediately
    console.log("✅ Sending success response to frontend");
    res.status(201).json({
      success: true,
      message: "Contact message sent successfully",
    });
  } catch (error) {
    console.error("❌ Error submitting contact form:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
