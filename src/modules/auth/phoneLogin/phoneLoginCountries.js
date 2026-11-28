const { getPhoneLoginCountryAllowlist } = require("./phoneLogin.config");

function isPhoneLoginCountryAllowed(isoCountry) {
  if (!isoCountry || typeof isoCountry !== "string") return false;
  return getPhoneLoginCountryAllowlist().has(isoCountry.toUpperCase());
}

function listPhoneLoginCountriesForApi() {
  return [...getPhoneLoginCountryAllowlist()].sort();
}

module.exports = {
  isPhoneLoginCountryAllowed,
  listPhoneLoginCountriesForApi,
};