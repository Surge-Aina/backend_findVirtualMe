const ProjectManagerContact = require('../models/ProjectManagerContact');
const Portfolio = require('../models/portfolioModel');
const UnifiedPortfolio = require("../../../modules/portfolios/models/Portfolio");
const { sendProjectManagerContactEmails } = require('../../../shared/services/emailService');
const { notifyLeadCaptured, notifyFormSubmitted } = require('../../../modules/public-api/lifecycleEvents');
const { consentContactFromBody } = require('../../../modules/public-api/leadConsent');

exports.submitContact = async (req, res) => {
  try {
    console.log('🔵 Project Manager contact form submitted');
    
    const { name, email, message, portfolioId } = req.body;
    
    // Validation
    if (!name || !email || !message || !portfolioId) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, email, message, and portfolioId are required' 
      });
    }
    
    // Get portfolio to fetch owner info (legacy ProjectManager or unified v2)
    let portfolio = await Portfolio.findById(portfolioId);
    let ownerEmail;
    let ownerName = 'Project Manager';

    if (portfolio) {
      ownerEmail = portfolio.email;
      ownerName = portfolio.name || 'Project Manager';
    } else {
      const v2 = await UnifiedPortfolio.findById(portfolioId).lean();
      if (!v2 || v2.template !== 'projectManager') {
        return res.status(404).json({
          success: false,
          message: 'Portfolio not found',
        });
      }
      const summary = (v2.sections || []).find((s) => s.type === 'summary')?.data || {};
      ownerEmail = summary.email;
      ownerName = summary.name || 'Project Manager';
      if (!ownerEmail) {
        return res.status(400).json({
          success: false,
          message: 'Portfolio owner email is not set in the summary section',
        });
      }
    }
    
    console.log("Portfolio found for contact");
    
    // Save contact to database
    const consentContact = consentContactFromBody(req.body);
    const contact = await ProjectManagerContact.create({
      portfolioId,
      ownerEmail,
      ownerName,
      name,
      email,
      message,
      status: 'new',
      ...(consentContact === undefined ? {} : { consentContact }),
    });
    
    console.log('✅ Contact saved to database:', contact._id);
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
      form: "projectManagerContact",
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
      message
    };
    
    // Send emails (non-blocking)
    sendProjectManagerContactEmails(formData, ownerEmail, ownerName)
      .then(() => {
        console.log('✅ Contact emails sent successfully');
      })
      .catch((error) => {
        console.error('❌ Error sending contact emails:', error.message);
        // Don't fail the request if emails fail
      });
    
    // Respond immediately
    console.log('✅ Sending success response to frontend');
    res.status(201).json({
      success: true,
      message: 'Contact message sent successfully'
    });
    
  } catch (error) {
    console.error('❌ Error submitting contact form:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};