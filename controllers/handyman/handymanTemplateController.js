    const HandymanTemplate = require('../../models/handyMan/HandymanTemplate');
    const UserModel = require('../../models/userModel');

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

    // Create a new portfolio for a user (owner taken from auth token)
    exports.createPortfolio = async (req, res) => {
    try {
        // auth middleware should set req.user.{id|userId}
        const ownerId = req.user?.userId || req.user?.id;
        if (!ownerId) {
        return res.status(401).json({ message: 'Unauthorized' });
        }

        // accept phone from a few shapes
        const phone =
        req.body?.handyman_portfolio?.phone ??
        req.body?.hero?.phoneNumber ??
        req.body?.phone ??
        null;

        const newHandymanPortfolio = await HandymanTemplate.create({
        userId: String(ownerId),
        hero: { phoneNumber: phone },
        });

        res.status(201).json(newHandymanPortfolio);
    } catch (error) {
        console.error('error adding portfolio', error);
        res.status(500).json({ message: 'error adding portfolio' });
    }
    };

    // Update an existing portfolio (only owner can update)
    exports.updatePortfolio = async (req, res) => {
    try {
        const ownerId = req.user?.userId || req.user?.id;
        if (!ownerId) {
        return res.status(401).json({ message: 'Unauthorized' });
        }

        const existing = await HandymanTemplate.findById(req.params.id);
        if (!existing) {
        return res.status(404).json({ message: 'Portfolio not found' });
        }

        if (String(existing.userId) !== String(ownerId)) {
        return res.status(403).json({ message: 'Forbidden: not your portfolio' });
        }

        // prevent takeover attempts
        const update = { ...req.body };
        delete update.userId;
        // normalize phone updates if client sends hero.phone or phone
        if (update.phone && !update.hero?.phoneNumber) {
        update.hero = { ...(existing.hero?.toObject?.() || existing.hero || {}), phoneNumber: update.phone };
        delete update.phone;
        }

        const updatedPortfolio = await HandymanTemplate.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true, runValidators: true }
        );

        res.json(updatedPortfolio);
    } catch (error) {
        res.status(500).json({ message: 'Error updating portfolio', error });
    }
    };
