/**
 * The portfolio templating system uses camelCase template keys
 * (e.g. `projectManager`), while the legacy `guestUser.portfolioType`
 * enum uses snake_case values (e.g. `project_manager`).
 *
 * This utility maps between the two. New code should call these helpers
 * any time the boundary between Portfolio.template and
 * GuestUser.portfolioType is crossed (e.g. AccountBlock -> /api/auth/guest).
 */

const TEMPLATE_TO_PORTFOLIO_TYPE = Object.freeze({
  healthcare: "healthcare",
  handyman: "handyman",
  photographer: "photographer",
  projectManager: "project_manager",
  dataScientist: "data_scientist",
  cleaningServices: "cleaning_services",
  localVendor: "local_vendor",
});

const PORTFOLIO_TYPE_TO_TEMPLATE = Object.freeze(
  Object.fromEntries(
    Object.entries(TEMPLATE_TO_PORTFOLIO_TYPE).map(([template, portfolioType]) => [
      portfolioType,
      template,
    ])
  )
);

function templateToPortfolioType(template) {
  if (!template) return null;
  return TEMPLATE_TO_PORTFOLIO_TYPE[template] || template;
}

function portfolioTypeToTemplate(portfolioType) {
  if (!portfolioType) return null;
  return PORTFOLIO_TYPE_TO_TEMPLATE[portfolioType] || portfolioType;
}

module.exports = {
  TEMPLATE_TO_PORTFOLIO_TYPE,
  PORTFOLIO_TYPE_TO_TEMPLATE,
  templateToPortfolioType,
  portfolioTypeToTemplate,
};
