const ProjectManager = require("../../models/projectManager/portfolioModel");
const Handyman = require("../../models/handyMan/HandymanTemplate");
const LocalVendor = require("../../models/localFoodVendor/LocalVendorPortfolio");
const CleaningLady = require("../../models/cleaningLady/Portfolio");
const Healthcare = require('../../models/healthcare/userData');

const modelMap = {
  ProjectManager,
  Handyman,
  LocalVendor,
  CleaningLady,
  Healthcare
};

exports.getPublicPortfolios = async () => {
  try {
    const [pm, hm, lv, cl, hc] = await Promise.all([
      ProjectManager.find({ isPublic: true }).lean(),
      Handyman.find({ isPublic: true }).lean(),
      LocalVendor.find({ isPublic: true }).lean(),
      CleaningLady.find({ isPublic: true }).lean(),
      Healthcare.find({ isPublic: true, isActive: true }).lean()
    ]);

    // Add portfolioType to healthcare portfolios for frontend
    const healthcareWithType = hc.map(portfolio => ({
      ...portfolio,
      portfolioType: 'Healthcare'
    }));

    return [...pm, ...hm, ...lv, ...cl, ...healthcareWithType];
  } catch (error) {
    console.log("getPublicPortfolios Error:", error);
    throw error;
  }
};

exports.getMyPortfolio = async (type, id) => {
  try {
    const Model = modelMap[type];
    if (!Model) throw new Error("Invalid portfolio type");

    // All portfolios use _id (ObjectId)
    const portfolio = await Model.findById(id).lean();

    return portfolio || null;
  } catch (error) {
    console.log("getMyPortfolio Error:", error.message);
    throw error;
  }
};

exports.togglePublicPortfolio = async (portfolioId) => {
  try {
    let updatedDoc = null;
    let modelType = null;
    
    // Try to find and update in each model
    for (const [type, Model] of Object.entries(modelMap)) {
      // First, find the document to get current isPublic value
      const doc = await Model.findById(portfolioId).select('isPublic').lean();
      
      if (doc) {
        // Update without validation
        updatedDoc = await Model.findByIdAndUpdate(
          portfolioId,
          { $set: { isPublic: !doc.isPublic } },
          { 
            new: true,
            runValidators: false,  
            select: '_id isPublic' 
          }
        );
        modelType = type;
        break;
      }
    }
    
    if (!updatedDoc) return null;
    
    return { 
      _id: updatedDoc._id,
      isPublic: updatedDoc.isPublic,
      portfolioType: modelType
    };
  } catch (error) {
    console.error("togglePublicPortfolio Error:", error);
    throw error;
  }
};

exports.deletePortfolio = async (portfolioId) => {
  try {
    let foundDoc = null;

    // Check all models by _id (including Healthcare)
    for (const [type, Model] of Object.entries(modelMap)) {
      const doc = await Model.findById(portfolioId);
      if (doc) {
        foundDoc = doc;
        break;
      }
    }

    if (!foundDoc) return null;

    await foundDoc.deleteOne();

    return { 
      _id: foundDoc._id
    };
  } catch (error) {
    console.error("deletePortfolio Error:", error);
    throw error;
  }
};