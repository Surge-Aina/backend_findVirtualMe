const {
  startVerifyForUser,
  confirmVerifyForUser,
  loginStart,
  loginVerify,
  statusForUser,
} = require("./phoneLogin.service");
const { handleServiceError } = require("./phoneLogin.middleware");
const { phoneLoginFlagOn } = require("./phoneLogin.config");
const { listPhoneLoginCountriesForApi } = require("./phoneLoginCountries");
const { clientIp } = require("../../../shared/middleware/rateLimit");

function phoneRequestContext(req) {
  const body = req.body || {};
  return {
    country: body.country,
    clientIp: clientIp(req),
  };
}

exports.listCountries = async (req, res) => {
  if (!phoneLoginFlagOn()) {
    return res.status(200).json({ countries: [] });
  }
  return res.status(200).json({ countries: listPhoneLoginCountriesForApi() });
};

exports.startVerify = async (req, res) => {
  try {
    const result = await startVerifyForUser(req.user._id, req.body.phone, phoneRequestContext(req));
    return res.status(200).json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
};

exports.confirmVerify = async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    const result = await confirmVerifyForUser(req.user._id, phone, code, phoneRequestContext(req));
    return res.status(200).json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
};

exports.loginStart = async (req, res) => {
  try {
    const result = await loginStart(req.body.phone, phoneRequestContext(req));
    return res.status(200).json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
};

exports.loginVerify = async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    const result = await loginVerify(phone, code, phoneRequestContext(req));
    return res.status(201).json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
};

exports.phoneStatus = async (req, res) => {
  try {
    const result = await statusForUser(req.user._id);
    return res.status(200).json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
};