// findUserPortfolios.controller.js
import * as findUserPortfoliosService from "./findUserPortfolios.service.js";

export const getFindUserPortfolios = async (req, res) => {
  try {
    const data = await findUserPortfoliosService.getFindUserPortfolios();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
