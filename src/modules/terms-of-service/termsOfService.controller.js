const { termsOfServiceService } = require("./termsOfService.service");

exports.getMyTermsOfService = async (req, res) => {
  try {
    const terms = await termsOfServiceService.getByOwner(req.user.id);
    res.json(terms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getTermsOfService = async (req, res) => {
  try {
    const terms = await termsOfServiceService.getById(req.params.id, req.user.id);
    if (!terms) {
      return res.status(404).json({ message: "Terms of service not found" });
    }
    res.json(terms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicTermsByPortfolio = async (req, res) => {
  try {
    const { portfolioId, type } = req.query;

    if (!portfolioId || !type) {
      return res
        .status(400)
        .json({ message: "Portfolio id and type are required" });
    }

    const terms = await termsOfServiceService.getPublicByPortfolio({
      id: portfolioId,
      type,
    });

    if (!terms) {
      return res.status(404).json({ message: "Terms of service not found" });
    }

    res.json(terms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.createTermsOfService = async (req, res) => {
  try {
    const created = await termsOfServiceService.create(req.body, req.user.id);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateTermsOfService = async (req, res) => {
  try {
    const updated = await termsOfServiceService.update(
      req.params.id,
      req.user.id,
      req.body,
    );

    if (!updated) {
      return res.status(404).json({ message: "Terms of service not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

exports.deleteTermsOfService = async (req, res) => {
  try {
    const deleted = await termsOfServiceService.remove(
      req.params.id,
      req.user.id,
    );

    if (!deleted) {
      return res.status(404).json({ message: "Terms of service not found" });
    }

    res.json({ message: "Terms of service deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
