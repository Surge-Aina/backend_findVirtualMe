const DataScientistContact = require('../../models/dataScientist/DataScientistContact');
const DataScientistPortfolio = require('../../models/dataScientist/DataScientistPortfolio');
const { sendDataScientistContactEmails } = require('../../src/shared/services/emailService');

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
    const contact = await DataScientistContact.create({
      portfolioId,
      ownerEmail,
      ownerName,
      name,
      email,
      message,
      status: 'new'
    });
    
    console.log('✅ Contact saved to database:', contact._id);
    
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