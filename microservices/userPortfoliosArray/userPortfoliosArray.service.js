const User = require("../../models/User");
const handymanModel = require("../../models/handyMan/HandymanTemplate");
const localFoodVendorModel = require("../../models/localFoodVendor/LocalVendorPortfolio");
const cleaningLadyModel = require("../../models/cleaningLady/Portfolio");
const projectManagerModel = require("../../models/projectManager/portfolioModel");

const modelsArrayUserId = [handymanModel, cleaningLadyModel];

const modelsArrayEmail = [localFoodVendorModel, projectManagerModel];

const portfolioModels = {
  Handyman: handymanModel,
  LocalVendor: localFoodVendorModel,
  CleaningLady: cleaningLadyModel,
  ProjectManager: projectManagerModel,
};

exports.getUserPortfoliosArrayByEmail = async (email) => {
  const results = await Promise.all(
    modelsArrayEmail.map((model) => model.find({ email: email }))
  );

  return results.flat(); // combine into one array
};

exports.getUserPortfoliosArrayByUserId = async (userId) => {
  const results = await Promise.all(
    modelsArrayUserId.map((model) => model.find({ userId: userId }))
  );

  return results.flat(); // combine into one array
};

async function updatePortfolioArray(userId, email) {
  try {
    const portfoliosByUserId = await Promise.all(
      modelsArrayUserId.map(async (model) => {
        const docs = await model.find({ userId }).lean();
        return docs.map((d) => ({ ...d, __modelName: model.modelName }));
      })
    );

    const portfoliosByEmail = await Promise.all(
      modelsArrayEmail.map(async (model) => {
        const docs = await model.find({ email }).lean();
        return docs.map((d) => ({ ...d, __modelName: model.modelName }));
      })
    );

    const allPortfolios = [...portfoliosByUserId.flat(), ...portfoliosByEmail.flat()];

    const byId = new Map();
    allPortfolios.forEach((p) => {
      if (!byId.has(String(p._id))) byId.set(String(p._id), p);
    });
    const uniquePortfolios = Array.from(byId.values());

    const userPortfolios = uniquePortfolios.map((p) => ({
      portfolioId: p._id,
      portfolioType: Object.keys(portfolioModels).find(
        (key) => portfolioModels[key].modelName === p.__modelName
      ),
      isPublic: false,
    }));

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { portfolios: userPortfolios },
      { new: true }
    );

    return updatedUser;
  } catch (error) {
    console.error("Error updating portfolio array:", error);
    throw error;
  }
}
exports.updatePortfolioArray = updatePortfolioArray;

exports.getPortfolioList = async (portfolioList) => {
  const results = await Promise.all(
    portfolioList.map(async (p) => {
      const model = portfolioModels[p.portfolioType];
      if (!model) return null; // unknown type
      return model.findById(p.portfolioId).lean();
    })
  );

  // Remove any nulls (invalid type or missing document)
  return results.filter(Boolean);
};

exports.updateAllUsersPortfolioArrays = async function () {
  const users = await User.find({}, { _id: 1, email: 1 });
  const updatedUsers = await Promise.all(
    users.map((user) => updatePortfolioArray(user._id, user.email))
  );
  return updatedUsers;
};
