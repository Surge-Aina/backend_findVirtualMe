const portfolioService = require("../services/portfolio.service");
const agentPortfolioGenerator = require("../services/agentPortfolioGenerator.service");

function sendPortfolioError(res, err, fallbackMessage) {
  if (err.code === 11000) {
    return res.status(400).json({ error: "Slug already taken", code: "DUPLICATE_SLUG" });
  }

  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  return res.status(500).json({ error: fallbackMessage });
}

function toAgentBlockList(blocks) {
  return blocks.map(({ type, label, description, templates }) => ({
    type,
    label,
    description,
    templates,
  }));
}

async function denyUnlessOwner(req, res) {
  const userId = req.user?._id || req.user?.id;
  const check = await portfolioService.assertPortfolioOwner(req.params.id, userId);
  if (!check.ok) {
    res.status(check.status).json({ error: check.error });
    return false;
  }
  return true;
}

exports.create = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    const {
      template,
      title,
      slug,
      sections,
      socialLinks,
      visibility,
      hideBranding,
      themeId,
      themeTokens,
      layoutMode,
      requestedCapability,
    } = req.body;

    if (!template) {
      return res.status(400).json({ error: "template is required" });
    }

    const portfolio = await portfolioService.createPortfolio(ownerId, template, {
      title,
      slug,
      sections,
      socialLinks,
      visibility,
      hideBranding,
      themeId,
      themeTokens,
      layoutMode,
      requestedCapability,
    });

    res.status(201).json({ success: true, portfolio });
  } catch (err) {
    console.error("portfolio.create error:", err);
    return sendPortfolioError(res, err, "Failed to create portfolio");
  }
};

exports.createAgent = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    const {
      baseTemplate,
      title,
      slug,
      sections,
      socialLinks,
      visibility,
      hideBranding,
      themeId,
      themeTokens,
      layoutMode,
      requestedCapability,
      generationModel,
      generationVersion,
      generationPromptHash,
    } = req.body;

    const portfolio = await portfolioService.createAgentPortfolio(ownerId, {
      baseTemplate,
      title,
      slug,
      sections,
      socialLinks,
      visibility,
      hideBranding,
      themeId,
      themeTokens,
      layoutMode,
      requestedCapability,
      generationModel,
      generationVersion,
      generationPromptHash,
    });

    res.status(201).json({ success: true, portfolio });
  } catch (err) {
    console.error("portfolio.createAgent error:", err);
    return sendPortfolioError(res, err, "Failed to create agent portfolio");
  }
};

exports.generateAgentFromPrompt = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    const result = await agentPortfolioGenerator.generateAgentPortfolioFromPrompt(
      ownerId,
      req.user,
      req.body || {}
    );

    res.status(201).json({
      success: true,
      portfolio: result.portfolio,
      source: result.source,
    });
  } catch (err) {
    console.error("portfolio.generateAgentFromPrompt error:", err);
    return sendPortfolioError(res, err, "Failed to generate agent portfolio");
  }
};

exports.getById = async (req, res) => {
  try {
    const portfolio = await portfolioService.getPortfolio(req.params.id);
    if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });
    res.json(portfolio);
  } catch (err) {
    console.error("portfolio.getById error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const portfolio = await portfolioService.getPortfolioBySlug(req.params.slug);
    if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });
    res.json(portfolio);
  } catch (err) {
    console.error("portfolio.getBySlug error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getMine = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    const portfolios = await portfolioService.getUserPortfolios(ownerId);
    res.json({ success: true, portfolios });
  } catch (err) {
    console.error("portfolio.getMine error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.listPublic = async (req, res) => {
  try {
    const { template } = req.query;
    const portfolios = await portfolioService.getPublicPortfolios(template || null);
    res.json({ success: true, portfolios });
  } catch (err) {
    console.error("portfolio.listPublic error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.update = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const updated = await portfolioService.updatePortfolio(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, portfolio: updated });
  } catch (err) {
    console.error("portfolio.update error:", err);
    return sendPortfolioError(res, err, "Failed to update portfolio");
  }
};

exports.updateSection = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const { id, sectionId } = req.params;
    const { data } = req.body;

    if (!data) return res.status(400).json({ error: "data is required" });

    const updated = await portfolioService.updateSection(id, sectionId, data);
    if (!updated) return res.status(404).json({ error: "Portfolio or section not found" });
    res.json({ success: true, portfolio: updated });
  } catch (err) {
    console.error("portfolio.updateSection error:", err);
    return sendPortfolioError(res, err, "Failed to update section");
  }
};

exports.addSection = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const { type, data, order } = req.body;

    if (!type) return res.status(400).json({ error: "type is required" });

    const updated = await portfolioService.addSection(req.params.id, type, data, order, {
      requestedCapability: req.body.requestedCapability,
    });
    if (!updated) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, portfolio: updated });
  } catch (err) {
    console.error("portfolio.addSection error:", err);
    return sendPortfolioError(res, err, "Failed to add section");
  }
};

exports.removeSection = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const { id, sectionId } = req.params;
    const updated = await portfolioService.removeSection(id, sectionId);
    if (!updated) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, portfolio: updated });
  } catch (err) {
    console.error("portfolio.removeSection error:", err);
    res.status(500).json({ error: "Failed to remove section" });
  }
};

exports.reorderSections = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds array is required" });
    }

    const updated = await portfolioService.reorderSections(req.params.id, orderedIds);
    if (!updated) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, portfolio: updated });
  } catch (err) {
    console.error("portfolio.reorderSections error:", err);
    res.status(500).json({ error: "Failed to reorder sections" });
  }
};

exports.toggleVisibility = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const result = await portfolioService.toggleVisibility(req.params.id);
    if (!result) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("portfolio.toggleVisibility error:", err);
    res.status(500).json({ error: "Failed to toggle visibility" });
  }
};

exports.toggleBranding = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const result = await portfolioService.toggleBranding(req.params.id);
    if (!result) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("portfolio.toggleBranding error:", err);
    res.status(500).json({ error: "Failed to toggle branding" });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!(await denyUnlessOwner(req, res))) return;
    const result = await portfolioService.deletePortfolio(req.params.id);
    if (!result) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, message: "Portfolio deleted" });
  } catch (err) {
    console.error("portfolio.remove error:", err);
    res.status(500).json({ error: "Failed to delete portfolio" });
  }
};

exports.getBlockTypes = async (req, res) => {
  try {
    const { BLOCK_TYPES, getBlockTypesForTemplate } = require("../models/portfolio/blockTypes");
    const { template, mode } = req.query;

    const isAgentMode = mode === "agent";
    if (template) {
      const blocks = getBlockTypesForTemplate(template);
      return res.json(isAgentMode ? toAgentBlockList(blocks) : blocks);
    }

    if (isAgentMode) {
      return res.json(
        toAgentBlockList(
          Object.entries(BLOCK_TYPES).map(([type, meta]) => ({ type, ...meta }))
        )
      );
    }

    res.json(BLOCK_TYPES);
  } catch (err) {
    console.error("portfolio.getBlockTypes error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
