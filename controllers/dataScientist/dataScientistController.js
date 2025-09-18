const mongoose = require('mongoose');

// Get the main portfolio data
const getPortfolio = async (req, res) => {
  try {
    // Use the existing collection directly since the data structure is different
    const db = mongoose.connection.db;
    const collection = db.collection('datascientistportfolios');
    
    let portfolio = await collection.findOne();
    
    if (!portfolio) {
      // Create a default portfolio if none exists
      portfolio = {
        name: 'Data Scientist',
        email: 'datascientist@example.com',
        title: 'Data Scientist & Machine Learning Engineer',
        summary: 'Passionate data scientist with expertise in machine learning and data analysis.',
        experience: [],
        education: [],
        projects: [],
        certificates: [],
        testimonials: [],
        extraParts: [],
        settings: { theme: 'terminal', showContact: true, showSkills: true },
        uiSettings: { baseRem: 1, sectionRem: { about: 1, skills: 1, projects: 1, experience: 1, education: 1, certificates: 1 } },
        portfolioId: 'datascience',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await collection.insertOne(portfolio);
    }
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
};

// Add item to a specific section
const addPortfolioItem = async (req, res) => {
  try {
    const { section } = req.params;
    const itemData = req.body;
    
    const db = mongoose.connection.db;
    const collection = db.collection('datascientistportfolios');
    
    let portfolio = await collection.findOne();
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Add item to the appropriate section
    if (portfolio[section]) {
      portfolio[section].push(itemData);
      await collection.updateOne({ _id: portfolio._id }, { $set: { [section]: portfolio[section], updatedAt: new Date() } });
      res.json({ message: 'Item added successfully', item: itemData });
    } else {
      res.status(400).json({ error: 'Invalid section' });
    }
  } catch (error) {
    console.error('Error adding portfolio item:', error);
    res.status(500).json({ error: 'Failed to add portfolio item' });
  }
};

// Update a specific item in a section
const updatePortfolioItem = async (req, res) => {
  try {
    const { section, id } = req.params;
    const updates = req.body;
    
    const db = mongoose.connection.db;
    const collection = db.collection('datascientistportfolios');
    
    let portfolio = await collection.findOne();
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    if (portfolio[section]) {
      // Find the item by its _id
      const itemIndex = portfolio[section].findIndex(item => item._id.toString() === id);
      
      if (itemIndex !== -1) {
        // Update the item
        portfolio[section][itemIndex] = { ...portfolio[section][itemIndex], ...updates };
        
        await collection.updateOne(
          { _id: portfolio._id },
          { $set: { [section]: portfolio[section], updatedAt: new Date() } }
        );
        
        res.json({ message: 'Item updated successfully', item: portfolio[section][itemIndex] });
      } else {
        res.status(404).json({ error: 'Item not found' });
      }
    } else {
      res.status(400).json({ error: 'Invalid section' });
    }
  } catch (error) {
    console.error('Error updating portfolio item:', error);
    res.status(500).json({ error: 'Failed to update portfolio item' });
  }
};

// Delete a specific item from a section
const deletePortfolioItem = async (req, res) => {
  try {
    const { section, id } = req.params;
    
    const db = mongoose.connection.db;
    const collection = db.collection('datascientistportfolios');
    
    let portfolio = await collection.findOne();
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    if (portfolio[section]) {
      // Find the item by its _id
      const itemIndex = portfolio[section].findIndex(item => item._id.toString() === id);
      
      if (itemIndex !== -1) {
        portfolio[section].splice(itemIndex, 1);
        await collection.updateOne(
          { _id: portfolio._id },
          { $set: { [section]: portfolio[section], updatedAt: new Date() } }
        );
        res.json({ message: 'Item deleted successfully' });
      } else {
        res.status(404).json({ error: 'Item not found' });
      }
    } else {
      res.status(400).json({ error: 'Invalid section' });
    }
  } catch (error) {
    console.error('Error deleting portfolio item:', error);
    res.status(500).json({ error: 'Failed to delete portfolio item' });
  }
};

// Update the entire portfolio
const updatePortfolio = async (req, res) => {
  try {
    const { portfolio: portfolioData } = req.body;
    
    const db = mongoose.connection.db;
    const collection = db.collection('datascientistportfolios');
    
    let portfolio = await collection.findOne();
    if (!portfolio) {
      portfolioData.createdAt = new Date();
      portfolioData.updatedAt = new Date();
      await collection.insertOne(portfolioData);
      portfolio = portfolioData;
    } else {
      portfolioData.updatedAt = new Date();
      await collection.updateOne({ _id: portfolio._id }, { $set: portfolioData });
      portfolio = { ...portfolio, ...portfolioData };
    }
    
    res.json({ message: 'Portfolio updated successfully', portfolio });
  } catch (error) {
    console.error('Error updating portfolio:', error);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
};

// Get testimonials
const getTestimonials = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('datascientistportfolios');
    
    const portfolio = await collection.findOne();
    if (!portfolio) {
      return res.json({ testimonials: [] });
    }
    res.json({ testimonials: portfolio.testimonials || [] });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
};

// Submit a testimonial
const submitTestimonial = async (req, res) => {
  try {
    const testimonialData = req.body;
    
    const db = mongoose.connection.db;
    const collection = db.collection('datascientistportfolios');
    
    let portfolio = await collection.findOne();
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    if (!portfolio.testimonials) {
      portfolio.testimonials = [];
    }
    
    portfolio.testimonials.push(testimonialData);
    await collection.updateOne(
      { _id: portfolio._id },
      { $set: { testimonials: portfolio.testimonials, updatedAt: new Date() } }
    );
    
    res.json({ message: 'Testimonial submitted successfully', testimonial: testimonialData });
  } catch (error) {
    console.error('Error submitting testimonial:', error);
    res.status(500).json({ error: 'Failed to submit testimonial' });
  }
};

module.exports = {
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  updatePortfolio,
  getTestimonials,
  submitTestimonial
};
