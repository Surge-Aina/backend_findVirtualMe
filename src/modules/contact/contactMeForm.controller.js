// contactMeForm.service.js
// const ProjectManagerContact = require("../../models/projectManager/ProjectManagerContact");
// const Portfolio = require("../../models/projectManager/portfolioModel");
const { sendGenericContactEmails } = require("../../shared/services/emailService");
const contactMeFormDB = require("./contactMeForm.model");
const { notifyLeadCaptured, notifyFormSubmitted } = require("../public-api/lifecycleEvents");
const { consentContactFromBody } = require("../public-api/leadConsent");
const { resolveContactDeliveryTarget } = require("./contactOwnerResolution");

exports.submitContact = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required",
      });
    }

    const delivery = await resolveContactDeliveryTarget(req.body);
    if (!delivery.ok) {
      return res.status(delivery.status).json({
        success: false,
        message: delivery.message,
      });
    }

    const { portfolioId, portfolioType, ownerEmail, ownerName } = delivery;

    const consentContact = consentContactFromBody(req.body);

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
      ...(consentContact === undefined ? {} : { consentContact }),
    });

    console.log("✅ Contact saved to database:", contact._id);
    const leadId = contact._id.toString();
    const consent = consentContact === undefined ? null : { contact: consentContact };
    notifyLeadCaptured({
      siteId: portfolioId,
      leadId,
      email,
      name,
      consent,
      createdAt: contact.createdAt,
    });
    notifyFormSubmitted({
      siteId: portfolioId,
      leadId,
      form: "contact",
      email,
      name,
      message,
      consent,
      submittedAt: contact.createdAt,
    });

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