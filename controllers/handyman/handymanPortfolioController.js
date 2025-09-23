<<<<<<< HEAD:controllers/handyman/handymanPortfolioController.js
const HandymanPortfolio = require('../../models/handyMan/handymanPortfolioModel');
const { uploadToCloudinary } = require('../../services/cloudinaryService');
=======
// controllers/handymanPortfolioController.js
const HandymanPortfolio = require('../models/handymanPortfolioModel');
const { uploadToCloudinary } = require('../services/cloudinaryService');
>>>>>>> 67878f7 (Initial Commit for feature one):controllers/handymanPortfolioController.js

const getPortfolioItems = async (req, res) => {
  try {
    const { templateId } = req.query;
    const query = templateId ? { templateId } : {};
    const items = await HandymanPortfolio.find(query).sort({ createdAt: -1 });
    res.json({ projects: items });
  } catch (error) {
    console.error('getPortfolioItems error', error);
    res.status(500).json({ message: 'Error fetching portfolio items' });
  }
};

const createPortfolioItem = async (req, res) => {
  try {
    const { title, category, templateId, beforeImageUrl, afterImageUrl } = req.body;

    if (!title || !category || !templateId) {
      return res.status(400).json({ message: 'title, category and templateId are required' });
    }

    // Accept either uploaded files or direct URLs
    let beforeUrl = beforeImageUrl;
    let afterUrl = afterImageUrl;

    if (req.files?.beforeImage?.[0]) {
      const r1 = await uploadToCloudinary(req.files.beforeImage[0].buffer);
      beforeUrl = r1.secure_url;
    }
    if (req.files?.afterImage?.[0]) {
      const r2 = await uploadToCloudinary(req.files.afterImage[0].buffer);
      afterUrl = r2.secure_url;
    }

    if (!beforeUrl || !afterUrl) {
      return res.status(400).json({ message: 'Both before and after images are required' });
    }

    const newItem = await HandymanPortfolio.create({
      templateId,
      title,
      category,
      beforeImageUrl: beforeUrl,
      afterImageUrl: afterUrl,
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error('createPortfolioItem error', error);
    res.status(500).json({ message: 'Error creating portfolio item.' });
  }
};

// Optional, but enables the “Save” / “Delete” buttons on existing rows
const updatePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    let update = { ...req.body };

    if (req.files?.beforeImage?.[0]) {
      const r1 = await uploadToCloudinary(req.files.beforeImage[0].buffer);
      update.beforeImageUrl = r1.secure_url;
    }
    if (req.files?.afterImage?.[0]) {
      const r2 = await uploadToCloudinary(req.files.afterImage[0].buffer);
      update.afterImageUrl = r2.secure_url;
    }

    const item = await HandymanPortfolio.findByIdAndUpdate(id, update, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (error) {
    console.error('updatePortfolioItem error', error);
    res.status(500).json({ message: 'Error updating portfolio item.' });
  }
};

const deletePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    await HandymanPortfolio.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('deletePortfolioItem error', error);
    res.status(500).json({ message: 'Error deleting portfolio item.' });
  }
};

module.exports = {
  getPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
};
