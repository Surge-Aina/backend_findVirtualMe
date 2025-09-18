const HandymanPortfolio = require('../../models/handyMan/handymanPortfolioModel');
const { uploadToCloudinary } = require('../../services/cloudinaryService');

const getPortfolioItems = async (req, res) => {
  try {
    const items = await HandymanPortfolio.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching portfolio items' });
  }
};

const createPortfolioItem = async (req, res) => {
  try {
    const { title, category } = req.body;
    const beforeImageResult = await uploadToCloudinary(req.files.beforeImage[0].buffer);
    const afterImageResult = await uploadToCloudinary(req.files.afterImage[0].buffer);

    const newItem = new HandymanPortfolio({
      title,
      category,
      beforeImageUrl: beforeImageResult.secure_url,
      afterImageUrl: afterImageResult.secure_url,
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: "Error creating portfolio item." });
  }
};

module.exports = { getPortfolioItems, createPortfolioItem };
