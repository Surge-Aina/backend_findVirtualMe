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
        const ownerId = req.user?.userId || req.user?.id;
        if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

        // Phone can arrive in a few shapes
        const phone =
        req.body?.handyman_portfolio?.phone ??
        req.body?.hero?.phoneNumber ??
        req.body?.contact?.phone ??
        req.body?.phone ??
        null;

        // Try to resolve the owner's email (fallback to request payload)
        let ownerEmail = req.body?.contact?.email ?? null;
        try {
        const owner = await UserModel.findById(ownerId).lean();
        if (owner?.email) ownerEmail = owner.email;
        } catch (_) {}

        const hero = { ...(req.body?.hero || {}) };
        if (phone && !hero.phoneNumber) hero.phoneNumber = phone;

        // ✅ Inject Contact defaults using onboarding data
        const contactBody = req.body?.contact || {};
        const contact = {
        title:    contactBody.title    || undefined,
        subtitle: contactBody.subtitle || undefined,
        formTitle: contactBody.formTitle || undefined,
        phone:    contactBody.phone    || phone || undefined,
        email:    contactBody.email    || ownerEmail || undefined,
        hours:    contactBody.hours    || undefined,
        note:     contactBody.note     || undefined,
        };

        const newHandymanPortfolio = await HandymanTemplate.create({
        userId: String(ownerId),
        hero,
        contact
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
        update.hero = {
            ...(existing.hero?.toObject?.() || existing.hero || {}),
            ...(update.hero || {}),
            phoneNumber: update.phone,
        };
        delete update.phone;
        }

        // ✅ Deep-merge hero so partial updates don't wipe other hero fields
        if (update.hero) {
        update.hero = {
            ...(existing.hero?.toObject?.() || existing.hero || {}),
            ...update.hero,
        };
        }

        // ✅ NEW: Deep-merge contact so partial updates don't wipe other contact fields
        if (update.contact) {
        update.contact = {
            ...(existing.contact?.toObject?.() || existing.contact || {}),
            ...update.contact,
        };
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

    // List portfolios (optionally by userId)
    exports.listPortfolios = async (req, res) => {
    try {
        const { userId } = req.query;
        const query = userId ? { userId } : {};
        const docs = await HandymanTemplate.find(query).sort({ createdAt: -1 });
        res.json(docs);
    } catch (error) {
        res.status(500).json({ message: 'Error listing portfolios', error });
    }
    };
