const ProjectManager = require("../../models/projectManager/portfolioModel");
const Handyman = require("../../models/handyMan/HandymanTemplate");
const LocalVendor = require("../../models/localFoodVendor/LocalVendorPortfolio");
const CleaningLady = require("../../models/cleaningLady/Portfolio");

const modelMap = {
  ProjectManager,
  Handyman,
  LocalVendor,
  CleaningLady,
};

exports.getPublicPortfolios = async () => {
  try {
    const [pm, hm, lv, cl] = await Promise.all([
      ProjectManager.find({ isPublic: true }).lean(),
      Handyman.find({ isPublic: true }).lean(),
      LocalVendor.find({ isPublic: true }).lean(),
      CleaningLady.find({ isPublic: true }).lean(),
    ]);

    return [...pm, ...hm, ...lv, ...cl];
  } catch (error) {
    console.log("getPublicPortfolios Error:", error);
    throw error;
  }
};

exports.getMyPortfolio = async (type, id) => {
  try {
    const Model = modelMap[type];

    if (!Model) throw new Error("Invalid portfolio type");

    const portfolio = await Model.findById(id).lean();

    return portfolio || null;
  } catch (error) {
    console.log("getMyPortfolio Error:", error);
    throw error;
  }
};

exports.togglePublicPortfolio = async (portfolioId) => {
  try {
    const Model = Object.values(modelMap).find((m) => m.findById);

    let foundDoc = null;

    for (const Model of Object.values(modelMap)) {
      const doc = await Model.findById(portfolioId);
      if (doc) {
        foundDoc = doc;
        break;
      }
    }

    if (!foundDoc) return null;

    foundDoc.isPublic = !foundDoc.isPublic;
    await foundDoc.save();

    return { _id: portfolioId, isPublic: foundDoc.isPublic };
  } catch (error) {
    console.error("togglePublicPortfolio Error:", error);
    throw error;
  }
};
