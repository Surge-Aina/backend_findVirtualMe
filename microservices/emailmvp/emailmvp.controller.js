// emailmvp.controller.js
const emailmvpService = require("./emailmvp.service");

exports.getEmailmvp = async (req, res) => {
  try {
    const data = await emailmvpService.getEmailmvp();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
