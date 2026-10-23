const DataScientistContact = require('../models/DataScientistContact');
const DataScientistPortfolio = require('../models/DataScientistPortfolio');
const { sendDataScientistContactEmails } = require('../../../shared/services/emailService');
const { notifyLeadCaptured, notifyFormSubmitted } = require('../../../modules/public-api/lifecycleEvents');
const { consentContactFromBody } = require('../../../modules/public-api/leadConsent');

exports.submitContact = async (req, res) => {
  try {
    console.log('🔵 Data Scientist contact form submitted');
    console.log('📥 Request body:', req.body);
    
    const { name, email, message, portfolioId } = req.body;
    
    // Validation
    if (!name || !email || !message || !portfolioId) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, email, message, and portfolioId are required' 
      });
    }
    
    // Get portfolio to fetch owner info
    const portfolio = await DataScientistPortfolio.findById(portfolioId);
    
    if (!portfolio) {
      return res.status(404).json({ 
        success: false,
        message: 'Portfolio not found' 
      });
    }
    
    const ownerEmail = portfolio.email;
    const ownerName = portfolio.name || 'Data Scientist';
    
    console.log('✅ Portfolio found:', ownerName);
    console.log('📧 Owner email:', ownerEmail);
    
    // Save contact to database
    const consentContact = consentContactFromBody(req.body);
    const contact = await DataScientistContact.create({
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
      form: "dataScientistContact",
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
    sendDataScientistContactEmails(formData, ownerEmail, ownerName)
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