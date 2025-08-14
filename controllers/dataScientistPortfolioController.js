const DataScientistPortfolio = require('../models/dataScientistPortfolioModel');

// Get the entire datascience portfolio
const getDataScientistPortfolio = async (req, res) => {
  try {
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error fetching datascience portfolio:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update the entire datascience portfolio
const updateDataScientistPortfolio = async (req, res) => {
  try {
    const { portfolio } = req.body;
    
    if (!portfolio) {
      return res.status(400).json({ message: 'Portfolio data is required' });
    }
    
    console.log('Received portfolio update request:', JSON.stringify(portfolio, null, 2));
    
    // Remove _id field from portfolio data to avoid MongoDB immutable field error
    const { _id, ...cleanPortfolio } = portfolio;
    
    // Also clean nested arrays to remove _id fields and ensure proper data structure
    if (cleanPortfolio.experience) {
      cleanPortfolio.experience = cleanPortfolio.experience.map(exp => {
        const { _id: expId, id, ...cleanExp } = exp;
        // Ensure description is always an array
        if (cleanExp.description && !Array.isArray(cleanExp.description)) {
          cleanExp.description = [cleanExp.description];
        }
        return cleanExp;
      });
    }
    if (cleanPortfolio.education) {
      cleanPortfolio.education = cleanPortfolio.education.map(edu => {
        const { _id: eduId, id, ...cleanEdu } = edu;
        // Ensure degrees is always an array
        if (cleanEdu.degrees && !Array.isArray(cleanEdu.degrees)) {
          cleanEdu.degrees = [cleanEdu.degrees];
        }
        return cleanEdu;
      });
    }
    if (cleanPortfolio.projects) {
      cleanPortfolio.projects = cleanPortfolio.projects.map(proj => {
        const { _id: projId, id, ...cleanProj } = proj;
        // Ensure tags is always an array
        if (cleanProj.tags && !Array.isArray(cleanProj.tags)) {
          cleanProj.tags = [cleanProj.tags];
        }
        return cleanProj;
      });
    }
    
    console.log('Cleaned portfolio data:', JSON.stringify(cleanPortfolio, null, 2));
    
    const updatedPortfolio = await DataScientistPortfolio.findOneAndUpdate(
      { portfolioId: 'datascience' },
      { ...cleanPortfolio, updatedAt: Date.now() },
      { new: true, upsert: true, runValidators: true }
    );
    
    console.log('Portfolio updated successfully');
    res.status(200).json(updatedPortfolio);
  } catch (error) {
    console.error('Error updating datascience portfolio:', error);
    console.error('Error details:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Add a new experience item
const addExperience = async (req, res) => {
  try {
    const experienceData = req.body;
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    portfolio.experience.push(experienceData);
    await portfolio.save();
    
    res.status(201).json(portfolio);
  } catch (error) {
    console.error('Error adding experience:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update an experience item
const updateExperience = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('Updating experience item:', id, updateData);
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    const experienceIndex = portfolio.experience.findIndex(exp => exp._id.toString() === id);
    
    if (experienceIndex === -1) {
      return res.status(404).json({ message: 'Experience item not found' });
    }
    
    // Ensure description is always an array
    if (updateData.description && !Array.isArray(updateData.description)) {
      updateData.description = [updateData.description];
    }
    
    portfolio.experience[experienceIndex] = { ...portfolio.experience[experienceIndex], ...updateData };
    await portfolio.save();
    
    console.log('Experience updated successfully');
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error updating experience:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete an experience item
const deleteExperience = async (req, res) => {
  try {
    const { id } = req.params;
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    portfolio.experience = portfolio.experience.filter(exp => exp._id.toString() !== id);
    await portfolio.save();
    
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error deleting experience:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Add a new education item
const addEducation = async (req, res) => {
  try {
    const educationData = req.body;
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    portfolio.education.push(educationData);
    await portfolio.save();
    
    res.status(201).json(portfolio);
  } catch (error) {
    console.error('Error adding education:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update an education item
const updateEducation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('Updating education item:', id, updateData);
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    const educationIndex = portfolio.education.findIndex(edu => edu._id.toString() === id);
    
    if (educationIndex === -1) {
      return res.status(404).json({ message: 'Education item not found' });
    }
    
    // Ensure degrees is always an array
    if (updateData.degrees && !Array.isArray(updateData.degrees)) {
      updateData.degrees = [updateData.degrees];
    }
    
    portfolio.education[educationIndex] = { ...portfolio.education[educationIndex], ...updateData };
    await portfolio.save();
    
    console.log('Education updated successfully');
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error updating education:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete an education item
const deleteEducation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    portfolio.education = portfolio.education.filter(edu => edu._id.toString() !== id);
    await portfolio.save();
    
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error deleting education:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Add a new project item
const addProject = async (req, res) => {
  try {
    const projectData = req.body;
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    portfolio.projects.push(projectData);
    await portfolio.save();
    
    res.status(201).json(portfolio);
  } catch (error) {
    console.error('Error adding project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update a project item
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('Updating project item:', id, updateData);
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    const projectIndex = portfolio.projects.findIndex(proj => proj._id.toString() === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ message: 'Project item not found' });
    }
    
    // Ensure tags is always an array
    if (updateData.tags && !Array.isArray(updateData.tags)) {
      updateData.tags = [updateData.tags];
    }
    
    portfolio.projects[projectIndex] = { ...portfolio.projects[projectIndex], ...updateData };
    await portfolio.save();
    
    console.log('Project updated successfully');
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete a project item
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const portfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    portfolio.projects = portfolio.projects.filter(proj => proj._id.toString() !== id);
    await portfolio.save();
    
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update summary/about section
const updateSummary = async (req, res) => {
  try {
    const { summary } = req.body;
    
    const portfolio = await DataScientistPortfolio.findOneAndUpdate(
      { portfolioId: 'datascience' },
      { summary, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error updating summary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update contact information
const updateContact = async (req, res) => {
  try {
    const { email, location, socialLinks } = req.body;
    
    const portfolio = await DataScientistPortfolio.findOneAndUpdate(
      { portfolioId: 'datascience' },
      { email, location, socialLinks, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Data Scientist portfolio not found' });
    }
    
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getDataScientistPortfolio,
  updateDataScientistPortfolio,
  addExperience,
  updateExperience,
  deleteExperience,
  addEducation,
  updateEducation,
  deleteEducation,
  addProject,
  updateProject,
  deleteProject,
  updateSummary,
  updateContact
};
