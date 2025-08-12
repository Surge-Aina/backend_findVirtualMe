const Portfolio = require('../models/portfolioModel');

exports.getPortfolioByEmail = async (req, res) => {
    const email = req.params.email;
    try{
        const portfolio = await Portfolio.findOne({email});
        if(!portfolio){
            res.status(404).json({message: 'portfolio not found'});
            return;
        }
        res.status(200).json(portfolio);
    }catch(error){
        console.log('error getting portfolio: ', error);
        res.status(500).json({message: 'error getting portfolio'});
    }
}

exports.getPortfolioById = async (req, res) => {
    const id = req.params.id
    console.log('id', id, typeof id);
    try{
        const portfolio = await Portfolio.findById(id);
        if(!portfolio){
            res.status(404).json({message: 'portfolio not found'});
            return;
        }
        res.status(200).json(portfolio);
    }catch(error){
        console.log('error getting portfolio: ', error);
        res.status(500).json({message: 'error getting portfolio'});
    }
}

exports.addPortfolio = async (req, res) => {
    const{ portfolio } = req.body;
    try{
        if(!portfolio){
            return res.status(400).json({message: 'portfolio needed'});
        }
        const newPortfolio = new Portfolio(portfolio);
        await newPortfolio.save();
        res.status(201).json(newPortfolio);
    }catch(error){
        console.error("error adding portfolio", error);
        res.status(500).json({ message: "error adding portfolio" });
    }
}

exports.editPortfolioByEmail = async (req, res) => {
    const email = req.query.email;
    const portfolio = req.body.portfolio;
    try{
        const updatedPortfolio = await Portfolio.findOneAndUpdate(
            {email: email},
            {$set: portfolio},
            {new: true}     //return updated document
        );

        if(!updatedPortfolio){
            res.status(404).json({message: 'item not found'});
            return;
        }
        res.json(updatedPortfolio);
    }catch(error){
        console.log('could not edit item', error);
        res.status(500).json({message: 'could not edit item'});
    }
}

exports.deletePortfolioByEmail = async (req, res) => {
    const email = req.query.email;
    try{
        const deletedItem = await Portfolio.findOneAndDelete({email});
        if(!deletedItem){
            res.status(404).json({message: "item not found"})
            return;
        }
        res.status(200).json({message:'item deleted successfully!'});
    }catch(error){
        console.log('error deleting portfolio: ', error);
        res.status(500).json({message: 'error deleting portfolio'});
    }
}