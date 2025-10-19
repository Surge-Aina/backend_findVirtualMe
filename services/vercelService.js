let vercelClientPromise = null;

async function getVercelClient() {
  if (vercelClientPromise) {
    return vercelClientPromise;
  }

  vercelClientPromise = (async () => {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      throw new Error("VERCEL_TOKEN environment variable is required");
    }

    const { Vercel } = await import("@vercel/sdk");
    vercelClient = new Vercel({
      bearerToken: token,
    });
    return vercelClient;
  })();

  return vercelClientPromise;
}

const projectId = process.env.VERCEL_PROJECT_ID || "frontend-find-virtual-me";

function normalizeVercelError(error) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown Vercel error" };
  }

  const normalized = {
    statusCode: error.statusCode || error?.response?.status,
    body: error.body,
    parsedBody: undefined,
    code: error.code,
    verification: error.verification,
    message: error.message,
    original: error,
  };

  const rawBody = error.body || error.parsedBody || error.response?.data;

  if (typeof rawBody === "string") {
    try {
      normalized.parsedBody = JSON.parse(rawBody);
    } catch {
      normalized.parsedBody = undefined;
    }
  } else if (rawBody && typeof rawBody === "object") {
    normalized.parsedBody = rawBody;
  }

  const bodyError = normalized.parsedBody?.error;
  if (bodyError?.code && !normalized.code) {
    normalized.code = bodyError.code;
  }
  if (bodyError?.message) {
    normalized.apiMessage = bodyError.message;
  }
  if (!normalized.verification && normalized.parsedBody?.verification) {
    normalized.verification = normalized.parsedBody.verification;
  }

  return normalized;
}

function buildVercelError(error, options = {}) {
  const { defaultMessage, prefix } = options;
  const normalized = normalizeVercelError(error);
  const detailMessage =
    normalized.apiMessage ||
    normalized.message ||
    defaultMessage ||
    prefix ||
    "Unknown Vercel error";

  let finalMessage;

  if (defaultMessage) {
    finalMessage =
      detailMessage === defaultMessage
        ? defaultMessage
        : `${defaultMessage}: ${detailMessage}`;
  } else if (prefix) {
    finalMessage =
      detailMessage === prefix ? prefix : `${prefix}: ${detailMessage}`;
  } else {
    finalMessage = detailMessage;
  }

  const wrapped = new Error(finalMessage);
  wrapped.name = "VercelAPIError";
  wrapped.statusCode = normalized.statusCode;
  wrapped.body = normalized.parsedBody ?? normalized.body;
  wrapped.code = normalized.code;
  wrapped.verification = normalized.verification;
  wrapped.originalError = normalized.original;

  return wrapped;
}

// Add domain to Vercel project
async function addDomain(domain) {
  try {
    const vercel = await getVercelClient();
    const result = await vercel.projects.addProjectDomain({
      idOrName: projectId,
      requestBody: {
        name: domain,
      },
      teamId: process.env.VERCEL_TEAM_ID,
    });

    console.log(`Domain added to Vercel: ${domain}`);

    return {
      success: true,
      domain: result.name,
      verified: result.verified,
      verification: result.verification, // DNS records needed
    };
  } catch (error) {
    console.error(`Failed to add domain ${domain}:`, error.message);
    throw buildVercelError(error, { prefix: "Vercel API error" });
  }
}

// Verify domain after DNS configured
async function verifyDomain(domain) {
  try {
    const vercel = await getVercelClient();
    const result = await vercel.projects.verifyProjectDomain({
      idOrName: projectId,
      domain: domain,
      teamId: process.env.VERCEL_TEAM_ID,
    });

    return {
      verified: result.verified,
      verification: result.verification,
    };
  } catch (error) {
    console.error(`Failed to verify domain ${domain}:`, error.message);
    throw buildVercelError(error, {
      defaultMessage: "Failed to verify domain",
    });
  }
}

// Remove domain from Vercel
async function removeDomain(domain) {
  try {
    const vercel = await getVercelClient();
    await vercel.projects.removeProjectDomain({
      idOrName: projectId,
      domain: domain,
      teamId: process.env.VERCEL_TEAM_ID,
    });

    return { success: true };
  } catch (error) {
    console.error(`Failed to remove domain ${domain}:`, error.message);
    throw buildVercelError(error, {
      defaultMessage: "Failed to remove domain",
    });
  }
}

// Get domain status
async function getDomainStatus(domain) {
  try {
    const vercel = await getVercelClient();
    const result = await vercel.projects.getProjectDomain({
      idOrName: projectId,
      domain: domain,
      teamId: process.env.VERCEL_TEAM_ID,
    });

    return {
      verified: result.verified,
      verification: result.verification,
    };
  } catch (error) {
    console.error(`Failed to get domain status ${domain}:`, error.message);
    throw buildVercelError(error, {
      defaultMessage: "Failed to get domain status",
    });
  }
}

async function getDomainConfig(domain) {
  try {
    const vercel = await getVercelClient();
    const result = await vercel.domains.getDomainConfig({
      domain: domain,
      teamId: process.env.VERCEL_TEAM_ID,
    });

    return {
      misconfigured: result.misconfigured,
      configuredBy: result.configuredBy,
      recommendedARecords: result.recommendedARecords,
      recommendedCNAMERecords: result.recommendedCNAMERecords,
      recommendedTXTRecords: result.recommendedTXTRecords,
    };
  } catch (error) {
    console.error(`Failed to get domain config for ${domain}:`, error.message);
    throw buildVercelError(error, {
      defaultMessage: "Failed to get domain config",
    });
  }
}

module.exports = {
  addDomain,
  verifyDomain,
  removeDomain,
  getDomainStatus,
  getDomainConfig,
};
