/**
 * Auth gates for legacy vertical writes.
 * Public storefront reads stay open. Mutations require the owner or an admin.
 */
const mongoose = require("mongoose");
const auth = require("../shared/middleware/auth");
const roleCheck = require("../shared/middleware/roleCheck");
const LocalVendorPortfolio = require("./local-vendor/models/LocalVendorPortfolio");
const HandymanPortfolio = require("./handyman/models/handymanPortfolioModel");
const HandymanTemplate = require("./handyman/models/HandymanTemplate");

function isAdmin(user) {
  return user?.role === "admin";
}

const adminOnly = [auth, roleCheck(["admin"])];

function emailsMatch(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a) && a === b;
}

async function requireVendorOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }
    if (isAdmin(req.user)) return next();

    const vendorId = req.params.vendorId;
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    const vendor = await LocalVendorPortfolio.findById(vendorId).select("email");
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    if (!emailsMatch(vendor.email, req.user.email)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  } catch (err) {
    console.error("requireVendorOwner error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

const vendorWrite = [auth, requireVendorOwner];

async function requireHandymanTemplateOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }
    if (isAdmin(req.user)) return next();

    let templateId = req.body?.templateId;
    if (!templateId && req.params.id) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ message: "Item not found" });
      }
      const item = await HandymanPortfolio.findById(req.params.id).select("templateId");
      if (!item) return res.status(404).json({ message: "Item not found" });
      templateId = item.templateId;
    }
    if (!templateId || !mongoose.Types.ObjectId.isValid(String(templateId))) {
      return res.status(400).json({ message: "templateId is required" });
    }
    const template = await HandymanTemplate.findById(templateId).select("userId");
    if (!template) return res.status(404).json({ message: "Template not found" });
    if (String(template.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  } catch (err) {
    console.error("requireHandymanTemplateOwner error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

function requireSelfOrAdminEmail(paramName = "email") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }
    if (isAdmin(req.user)) return next();
    if (!emailsMatch(req.params[paramName], req.user.email)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

module.exports = {
  auth,
  adminOnly,
  vendorWrite,
  requireVendorOwner,
  requireHandymanTemplateOwner,
  requireSelfOrAdminEmail,
  isAdmin,
};
