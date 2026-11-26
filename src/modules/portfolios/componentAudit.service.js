const ComponentAudit = require("./models/ComponentAudit");

async function recordComponentAudit({
  portfolioId,
  ownerId,
  action,
  componentId = "",
  sectionId = "",
  source,
  authType,
  installationId = null,
  apiKeyId = null,
}) {
  await ComponentAudit.create({
    portfolioId,
    ownerId,
    action,
    componentId,
    sectionId: sectionId ? String(sectionId) : "",
    source,
    authType,
    installationId: installationId || null,
    apiKeyId: apiKeyId || null,
  });
}

module.exports = {
  recordComponentAudit,
};