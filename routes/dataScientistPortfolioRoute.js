const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/dataScientistPortfolioController');

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'Data Science Portfolio API is running',
    timestamp: new Date().toISOString()
  });
});

// Main portfolio routes
router.get('/', getDataScientistPortfolio);
router.patch('/update', updateDataScientistPortfolio);

// Experience routes
router.post('/experience', addExperience);
router.patch('/experience/:id', updateExperience);
router.delete('/experience/:id', deleteExperience);

// Education routes
router.post('/education', addEducation);
router.patch('/education/:id', updateEducation);
router.delete('/education/:id', deleteEducation);

// Project routes
router.post('/project', addProject);
router.patch('/project/:id', updateProject);
router.delete('/project/:id', deleteProject);

// Summary/About routes
router.patch('/summary', updateSummary);

// Contact routes
router.patch('/contact', updateContact);

module.exports = router;
