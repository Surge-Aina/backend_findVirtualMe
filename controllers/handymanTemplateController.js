const HandymanTemplate = require('../models/HandymanTemplate');
const User = require('../models/userModel');

// Get a portfolio by its unique ID
exports.getPortfolioById = async (req, res) => {
    try {
        const portfolio = await HandymanTemplate.findById(req.params.id);
        if (!portfolio) {
            return res.status(404).json({ message: 'Handyman portfolio not found' });
        }
        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching portfolio data', error });
    }
};

// Get a portfolio by the user's ID
exports.getPortfolioByUserId = async (req, res) => {
    try {
        const portfolio = await HandymanTemplate.findOne({ userId: req.params.userId });
        if (!portfolio) {
            return res.status(404).json({ message: 'Handyman portfolio not found for this user' });
        }
        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching portfolio data', error });
    }
};


// Create a new portfolio for a user (e.g., upon signup or first time setup)
exports.createPortfolio = async (req, res) => {
    try {
        const { userId } = req.body;
        
        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const existingPortfolio = await HandymanTemplate.findOne({ userId });
        if (existingPortfolio) {
            return res.status(400).json({ message: 'Portfolio for this user already exists' });
        }

        const newPortfolio = new HandymanTemplate({ userId });
        await newPortfolio.save();

        // Optionally add the portfolio ID to the user model
        existingUser.portfolioIds.push(newPortfolio._id.toString());
        await existingUser.save();

        res.status(201).json(newPortfolio);
    } catch (error) {
        res.status(500).json({ message: 'Error creating portfolio', error });
    }
};

// Update an existing portfolio
exports.updatePortfolio = async (req, res) => {
    try {
        const updatedPortfolio = await HandymanTemplate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedPortfolio) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }
        res.json(updatedPortfolio);
    } catch (error) {
        res.status(500).json({ message: 'Error updating portfolio', error });
    }
};