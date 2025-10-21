
const {sendQuoteEmails} = require('../../services/emailService')
const mongoose = require('mongoose');

const Portfolio = require('../../models/cleaningLady/Portfolio');
const User = require('../../models/User');
const QuoteRequest = mongoose.models.QuoteRequest || require('../../models/cleaningLady/QuoteRequest');
// ============================================
// PUBLIC ENDPOINTS (No login required)
// ============================================

exports.getAllPortfolios = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const portfolios = await Portfolio.find({})
      .populate('userId', 'email _id firstName lastName');
    
    const portfoliosWithEmail = portfolios.map(p => ({
      ...p.toObject(),
      email: p.userId?.email,
      userEmail: p.userId?.email,
      ownerEmail: p.userId?.email
    }));
    
    res.json(portfoliosWithEmail);
  } catch (error) {
    console.error('Error fetching all portfolios:', error);
    res.status(500).json({ message: 'Error fetching portfolios' });
  }
};

exports.getPublicPortfolio = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const portfolio = await Portfolio.findOne({
      slug,
      isPublished: true
    }).populate('userId', 'firstName lastName email username');
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    res.json({
      portfolio,
      isOwner: false
    });
  } catch (error) {
    console.error('Error fetching public portfolio:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔍 Fetching portfolio for user:', userId);
    
    let portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      console.log('⚠️ No portfolio found, creating default one...');
      
      portfolio = await Portfolio.create({
        userId,
        slug: `user-cleaning-${Date.now()}`,
        templateType: 'cleaning-service',
        businessName: 'My Cleaning Service',
        tagline1: "DOM's Cleaning – We bring sparkle to your space.",
        tagline2: 'From roof to floor – Every detail matters.',
        tagline3: 'For those I love – My purpose in every sweep.'
      });
      
      console.log('✅ Default portfolio created:', portfolio._id);
    }
    
    console.log('✅ Portfolio found:', portfolio._id);
    
    res.json({
      portfolio,
      isOwner: true
    });
    
  } catch (error) {
    console.error('❌ Error fetching portfolio:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================================
// PROTECTED ENDPOINTS (Require FindVirtualMe login)
// ============================================

exports.getPortfolioById = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    
    console.log('🔍 getPortfolioById called:', portfolioId);
    
    const portfolio = await Portfolio.findById(portfolioId);
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    console.log('🔍 Portfolio found:', portfolio._id);
    console.log('🔍 Portfolio userId:', portfolio.userId);
    
    let isOwner = false;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        console.log('🔍 Decoded token:', decoded);
        
        const user = await User.findById(decoded.id);
        
        console.log('🔍 User found:', user ? user.email : 'none');
        console.log('🔍 User _id:', user ? user._id : 'none');
        
        if (user && user._id && portfolio.userId) {
          const userIdString = user._id.toString();
          const portfolioUserIdString = portfolio.userId.toString();
          
          console.log('🔍 Comparing:', userIdString, '===', portfolioUserIdString);
          
          if (userIdString === portfolioUserIdString) {
            console.log('✅ User is the owner!');
            isOwner = true;
          } else {
            console.log('❌ User is NOT the owner');
          }
        } else {
          console.log('⚠️ Missing user._id or portfolio.userId');
          console.log('   user._id:', user?._id);
          console.log('   portfolio.userId:', portfolio.userId);
        }
      } catch (err) {
        console.log('⚠️ Token verification failed:', err.message);
      }
    } else {
      console.log('⚠️ No token provided');
    }
    
    console.log('🔍 Final isOwner:', isOwner);
    
    res.json({
      portfolio,
      isOwner
    });
    
  } catch (error) {
    console.error('❌ Error fetching portfolio:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.savePortfolio = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('🔍 Looking for portfolio with userId:', user._id);
    
    let portfolio = await Portfolio.findOne({
      userId: user._id
    });
    
    console.log('🔍 Found existing portfolio?', portfolio ? 'YES' : 'NO');
    
    if (portfolio) {
      console.log('🔍 Updating existing portfolio');
      Object.assign(portfolio, req.body);
      portfolio.updatedAt = Date.now();
      await portfolio.save();
      
      res.json({
        message: 'Portfolio updated successfully',
        portfolio
      });
    } else {
      console.log('🔍 Creating new portfolio with slug:', req.body.slug);
      
      portfolio = new Portfolio();
      portfolio.userId = user._id;
      portfolio.slug = req.body.slug || `user-${Date.now()}`;
      portfolio.templateType = req.body.templateType || 'cleaning-service';
      portfolio.businessName = req.body.businessName || 'My Cleaning Service';
      portfolio.tagline = req.body.tagline;
      portfolio.tagline1 = req.body.tagline1;
      portfolio.tagline2 = req.body.tagline2;
      portfolio.tagline3 = req.body.tagline3;
      portfolio.aboutUs = req.body.aboutUs;
      portfolio.services = req.body.services || [];
      portfolio.roomPricing = req.body.roomPricing || [];
      portfolio.contactInfo = req.body.contactInfo || {};
      portfolio.theme = req.body.theme || {};
      
      await portfolio.save();
      
      res.status(201).json({
        message: 'Portfolio created successfully',
        portfolio
      });
    }
  } catch (error) {
    console.log('🔍 Error code:', error.code);
    console.log('🔍 Full error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Slug already taken. Please choose a different one.'
      });
    }
    console.error('Error saving portfolio:', error);
    res.status(500).json({ message: 'Error saving portfolio' });
  }
};

exports.updateMyPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    console.log('🔍 Updating portfolio for user:', userId);
    console.log('🔍 Update data:', updates);
    
    const updateQuery = {};
    for (const [key, value] of Object.entries(updates)) {
      updateQuery[key] = value;
    }
    
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId },
      { $set: updateQuery },
      { new: true, runValidators: true }
    );
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    console.log('✅ Portfolio updated successfully');
    
    res.json({
      message: 'Portfolio updated successfully',
      portfolio
    });
    
  } catch (error) {
    console.error('❌ Error updating portfolio:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.publishPortfolio = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId: user._id },
      { isPublished: true, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    res.json({
      message: 'Portfolio published successfully!',
      portfolio,
      publicUrl: `/portfolio/${portfolio.slug}`
    });
  } catch (error) {
    console.error('Error publishing portfolio:', error);
    res.status(500).json({ message: 'Error publishing portfolio' });
  }
};

exports.unpublishPortfolio = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId: user._id },
      { isPublished: false, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    res.json({
      message: 'Portfolio unpublished',
      portfolio
    });
  } catch (error) {
    console.error('Error unpublishing portfolio:', error);
    res.status(500).json({ message: 'Error unpublishing portfolio' });
  }
};

// ============================================
// SERVICES MANAGEMENT
// ============================================

exports.addService = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const portfolio = await Portfolio.findOne({
      userId: user._id
    });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found. Create a portfolio first.' });
    }
    
    const { title, description, price, icon } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }
    
    portfolio.services.push({ title, description, price, icon });
    await portfolio.save();
    
    res.json({
      message: 'Service added successfully',
      services: portfolio.services
    });
  } catch (error) {
    console.error('Error adding service:', error);
    res.status(500).json({ message: 'Error adding service' });
  }
};

exports.updateService = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const portfolio = await Portfolio.findOne({
      userId: user._id
    });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    const service = portfolio.services.id(req.params.serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    Object.assign(service, req.body);
    await portfolio.save();
    
    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ message: 'Error updating service' });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const portfolio = await Portfolio.findOne({
      userId: user._id
    });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    portfolio.services.pull(req.params.serviceId);
    await portfolio.save();
    
    res.json({
      message: 'Service deleted successfully',
      services: portfolio.services
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: 'Error deleting service' });
  }
};

// ============================================
// ROOM PRICING MANAGEMENT
// ============================================

exports.updateRoomPricing = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const portfolio = await Portfolio.findOne({
      userId: user._id
    });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    portfolio.roomPricing = req.body.roomPricing;
    await portfolio.save();
    
    res.json({
      message: 'Room pricing updated successfully',
      roomPricing: portfolio.roomPricing
    });
  } catch (error) {
    console.error('Error updating room pricing:', error);
    res.status(500).json({ message: 'Error updating room pricing' });
  }
};

// ============================================
// QUOTES MANAGEMENT
// ============================================

// exports.submitQuote = async (req, res) => {
//   try {
//     const { services, details, dueDate, name, email, phone, portfolioId } = req.body;
    
//     if (!services || !services.length) {
//       return res.status(400).json({ message: 'Services are required' });
//     }
    
//     if (!name || !email || !phone || !dueDate) {
//       return res.status(400).json({ message: 'All contact fields are required' });
//     }
    
//     const newQuote = await QuoteRequest.create({
//       portfolioId,
//       services,
//       details: details || '',
//       dueDate,
//       name,
//       email,
//       phone,
//       status: 'new'
//     });
    
//     console.log('✅ Quote submitted:', newQuote);
    
//     res.status(201).json({
//       message: 'Quote request submitted successfully',
//       quote: newQuote
//     });
    
//   } catch (error) {
//     console.error('❌ Error submitting quote:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

exports.submitQuote = async (req, res) => {
  try {
    console.log('🔵 submitQuote called');
    console.log('📥 Request body:', req.body);
    const { services, details, dueDate, name, email, phone, portfolioId } = req.body;
    
    // Validation
    if (!services || !services.length) {
      return res.status(400).json({ message: 'Services are required' });
    }
    
    if (!name || !email || !phone || !dueDate) {
      return res.status(400).json({ message: 'All contact fields are required' });
    }
    
     console.log('🔍 Looking for portfolio:', portfolioId);
    // Get portfolio to fetch owner email and business name
    const portfolio = await Portfolio.findById(portfolioId)
      .populate('userId', 'email');
    
    if (!portfolio) {
       console.log('❌ Portfolio not found');
      return res.status(404).json({ message: 'Portfolio not found' });
    }
        console.log('✅ Portfolio found:', portfolio.businessName);
    console.log('📧 Owner email:', portfolio.userId?.email);
    
    const ownerEmail = portfolio.userId?.email;
    const businessName = portfolio.businessName || 'Cleaning Service';
    
    if (!ownerEmail) {
      console.warn('⚠️ Owner email not found, emails will not be sent');
    }
    
    // Save quote to database
    const newQuote = await QuoteRequest.create({
      portfolioId,
      services,
      details: details || '',
      dueDate,
      name,
      email,
      phone,
      status: 'new'
    });
    
    console.log('✅ Quote saved to database:', newQuote._id);
    
    // Send emails (non-blocking - don't wait for completion)
    if (ownerEmail) {
          console.log('📧 Preparing to send emails...');
      const formData = {
        name,
        email,
        phone,
        services,
        dueDate,
        details: details || ''
      };
      
      // Send emails asynchronously
      sendQuoteEmails(formData, ownerEmail, businessName)
        .then(() => {
          console.log('✅ All emails sent successfully');
        })
        .catch((error) => {
          console.error('❌ Error sending emails:', error.message);
          // Don't fail the request if emails fail
        });
    }
    
    // Respond immediately (don't wait for emails)
    res.status(201).json({
      message: 'Quote request submitted successfully',
      quote: newQuote
    });
    
  } catch (error) {
    console.error('❌ Error submitting quote:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getMyQuotes = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    const quotes = await QuoteRequest.find({
      portfolioId: portfolio._id
    }).sort({ createdAt: -1 });
    
    console.log('✅ Fetched quotes:', quotes.length);
    
    res.json(quotes);
    
  } catch (error) {
    console.error('❌ Error fetching quotes:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quoteId } = req.params;
    const { status } = req.body;
    
    const portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }
    
    const quote = await QuoteRequest.findOne({
      _id: quoteId,
      portfolioId: portfolio._id
    });
    
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }
    
    quote.status = status;
    await quote.save();
    
    console.log('✅ Quote status updated:', quote);
    
    res.json({
      message: 'Quote status updated',
      quote
    });
    
  } catch (error) {
    console.error('❌ Error updating quote status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};