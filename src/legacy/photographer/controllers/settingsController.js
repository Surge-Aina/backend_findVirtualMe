const Settings = require('../models/settingsModel');

// Get a setting by key
const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { portfolioId } = req.query;
    if (!portfolioId) {
      return res.status(400).json({ error: 'portfolioId is required' });
    }
    const setting = await Settings.findOne({ key, portfolioId });
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error('Error getting setting:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
};

// Update or create a setting
const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, portfolioId } = req.body;
    if (!portfolioId) {
      return res.status(400).json({ error: 'portfolioId is required' });
    }
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    const setting = await Settings.findOneAndUpdate(
      { key, portfolioId },
      { value, updatedAt: new Date(), portfolioId },
      { upsert: true, new: true }
    );
    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

// Get all settings
const getAllSettings = async (req, res) => {
  try {
    const { portfolioId } = req.query;
    if (!portfolioId) {
      return res.status(400).json({ error: 'portfolioId is required' });
    }
    const settings = await Settings.find({ portfolioId });
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.key] = setting.value;
    });
    res.json(settingsObject);
  } catch (error) {
    console.error('Error getting all settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
}; 

const addSettings = async (req, res) => {
  try {
    const { portfolioId, templateData } = req.body;
    
    if (!portfolioId) {
      return res.status(400).json({ error: 'portfolioId is required' });
    }
    
    if (!templateData || typeof templateData !== 'object') {
      return res.status(400).json({ error: 'templateData is required and must be an object' });
    }

    const existingSettings = await Settings.find({ portfolioId });
    if (existingSettings.length > 0) {
      return res.status(409).json({ error: 'Portfolio with this ID already exists' });
    }

    // Create settings array from templateData
    const settingsToCreate = [];
    for (const [key, value] of Object.entries(templateData)) {
      settingsToCreate.push({
        portfolioId,
        key,
        value,
        updatedAt: new Date()
      });
    }

    const createdSettings = await Settings.insertMany(settingsToCreate);
    
    const settingsObject = {};
    createdSettings.forEach(setting => {
      settingsObject[setting.key] = setting.value;
    });

    res.status(201).json({
      message: 'Portfolio settings created successfully',
      portfolioId,
      settings: settingsObject,
      count: createdSettings.length
    });

  } catch (error) {
    console.error('Error adding settings:', error);
    res.status(500).json({ error: 'Failed to add settings' });
  }
}

const deleteSettings = async (req, res) => {
  try {
    const { portfolioId } = req.query;
    
    if (!portfolioId) {
      return res.status(400).json({ error: 'portfolioId is required' });
    }

    const existingSettings = await Settings.find({ portfolioId });
    if (existingSettings.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const deleteResult = await Settings.deleteMany({ portfolioId });

    res.json({
      message: 'Portfolio settings deleted successfully',
      portfolioId,
      deletedCount: deleteResult.deletedCount
    });

  } catch (error) {
    console.error('Error deleting settings:', error);
    res.status(500).json({ error: 'Failed to delete settings' });
  }
}

module.exports = {
  getSetting,
  updateSetting,
  getAllSettings,
  addSettings,
  deleteSettings
};