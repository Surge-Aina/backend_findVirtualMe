<<<<<<< HEAD:controllers/handyman/handymanTemplateController.js
const HandymanTemplate = require('../../models/handyMan/HandymanTemplate');
const User = require('../../models/userModel');
const UserModel = require("../../models/User");
=======
const HandymanTemplate = require('../models/HandymanTemplate');
const UserModel = require('../models/userModel');

>>>>>>> 67878f7 (Initial Commit for feature one):controllers/handymanTemplateController.js
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

// Create a new portfolio for a user (e.g., upon signup or first time setup)

exports.createPortfolio = async (req, res) => {
<<<<<<< HEAD:controllers/handyman/handymanTemplateController.js
    try {
        //const { userId } = req.body;

        const userId = req.body.portfolio._id
        
        const existingUser = await UserModel.findById(userId);
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
=======
        console.log("Logs:", req.body);
        const id = req.body.handyman_portfolio._id;
        const ph = req.body.handyman_portfolio.phone
            try{
                if(!id){
                    return res.status(400).json({message: 'portfolio needed'});
                }
                const newHandymanPortfolio = new HandymanTemplate({userId:id, hero: {phoneNumber: ph}});
                await newHandymanPortfolio.save();
                res.status(201).json(newHandymanPortfolio);
            }catch(error){
                console.error("error adding portfolio", error);
                res.status(500).json({ message: "error adding portfolio" });
            }
        };
>>>>>>> 67878f7 (Initial Commit for feature one):controllers/handymanTemplateController.js

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