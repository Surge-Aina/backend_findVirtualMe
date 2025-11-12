// services/exec.service.js
const contactSvc = require("../../aiPortfolioCreator/contact/aiPortfolioCreator.service");

exports.executeAction = async (action, args = {}) => {
  switch (action) {
    case "contact.create":
      return await contactSvc.createContact(args);
    case "contact.update":
      return await contactSvc.updateContact(args?.id, args);
    case "contact.ensure":
      return await contactSvc.ensureContact(args);
    case "contact.list":
      return await contactSvc.listContacts(args);
    default:
      const err = new Error("Unknown action");
      err.statusCode = 400;
      throw err;
  }
};
