// testNewFeatureCorrected.controller.js
import * as testNewFeatureCorrectedService from "./testNewFeatureCorrected.service.js";

export const getTestNewFeatureCorrected = async (req, res) => {
  try {
    const data = await testNewFeatureCorrectedService.getTestNewFeatureCorrected();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
