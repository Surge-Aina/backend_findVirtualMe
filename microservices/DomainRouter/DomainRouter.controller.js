// DomainRouter.controller.js
const DomainRouterService = require("./DomainRouter.service");

exports.getDomainRouter = async (req, res) => {
  try {
    const data = await DomainRouterService.getDomainRouter();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
