const { Vercel } = require('@vercel/sdk');

const vercel = new Vercel({
  bearerToken: process.env.VERCEL_TOKEN,
});

const projectId = process.env.VERCEL_PROJECT_ID || 'frontend-find-virtual-me';

// Add domain to Vercel project
async function addDomain(domain, userId, portfolioId) {
  try {
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
    throw new Error(`Vercel API error: ${error.message}`);
  }
}

// Verify domain after DNS configured
async function verifyDomain(domain) {
  try {
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
    throw new Error(`Failed to verify domain: ${error.message}`);
  }
}

// Remove domain from Vercel
async function removeDomain(domain) {
  try {
    await vercel.projects.removeProjectDomain({
      idOrName: projectId,
      domain: domain,
      teamId: process.env.VERCEL_TEAM_ID,
    });
    
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to remove domain: ${error.message}`);
  }
}

// Get domain status
async function getDomainStatus(domain) {
  try {
    const result = await vercel.projects.getProjectDomain({
      idOrName: projectId,
      domain: domain,
    });
    
    return {
      verified: result.verified,
      verification: result.verification,
    };
  } catch (error) {
    throw new Error(`Failed to get domain status: ${error.message}`);
  }
}

async function getDomainConfig(domain) {
    try {
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
    throw new Error(`Failed to get domain config: ${error.message}`);
  }
}


module.exports = {
  addDomain,
  verifyDomain,
  removeDomain,
  getDomainStatus,
  getDomainConfig,
};



