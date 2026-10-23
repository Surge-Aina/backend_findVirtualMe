const { privacyPolicyService } = require("./privacyPolicy.service");

exports.getMyPrivacyPolicies = async (req, res) => {
  try {
    const policies = await privacyPolicyService.getByOwner(req.user.id);
    res.json(policies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getPrivacyPolicy = async (req, res) => {
  try {
    const policy = await privacyPolicyService.getById(req.params.id, req.user.id);
    if (!policy) {
      return res.status(404).json({ message: "Privacy policy not found" });
    }
    res.json(policy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicPrivacyPolicyByPortfolio = async (req, res) => {
  try {
    const { portfolioId, type } = req.query;

    if (!portfolioId || !type) {
      return res
        .status(400)
        .json({ message: "Portfolio id and type are required" });
    }

    const policy = await privacyPolicyService.getPublicByPortfolio({
      id: portfolioId,
      type,
    });

    if (!policy) {
      return res.status(404).json({ message: "Privacy policy not found" });
    }

    res.json(policy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.createPrivacyPolicy = async (req, res) => {
  try {
    const created = await privacyPolicyService.create(req.body, req.user.id);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

exports.updatePrivacyPolicy = async (req, res) => {
  try {
    const updated = await privacyPolicyService.update(
      req.params.id,
      req.user.id,
      req.body,
    );

    if (!updated) {
      return res.status(404).json({ message: "Privacy policy not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

exports.deletePrivacyPolicy = async (req, res) => {
  try {
    const deleted = await privacyPolicyService.remove(
      req.params.id,
      req.user.id,
    );

    if (!deleted) {
      return res.status(404).json({ message: "Privacy policy not found" });
    }

    res.json({ message: "Privacy policy deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

