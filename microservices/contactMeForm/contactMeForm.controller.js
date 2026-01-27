// contactMeForm.service.js
// const ProjectManagerContact = require("../../models/projectManager/ProjectManagerContact");
// const Portfolio = require("../../models/projectManager/portfolioModel");
const { sendGenericContactEmails } = require("../../services/emailService");
const contactMeFormDB = require("./contactMeForm.model");

exports.submitContact = async (req, res) => {
  try {
    const { name, email, message, portfolioId, ownerEmail, ownerName } = req.body;

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
