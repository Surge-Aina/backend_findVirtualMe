const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const express = require("express");
const { authenticateApiKey } = require("./publicApi.auth");
const { publicApiRateLimit } = require("./rateLimit");
const sitesService = require("./sites.service");
const leadsService = require("./leads.service");
const { listEndpoints } = require("./webhook.service");

function textResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function scopeError(scope) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ code: "insufficient_scope", requiredScope: scope }) }],
  };
}

function hasScope(auth, scope) {
  return (auth.key?.scopes || []).includes(scope);
}

function installedSiteId(auth) {
  if (auth?.authType !== "oauth" || !auth.siteId) return null;
  return String(auth.siteId);
}

function registerTools(server, auth) {
  const ownerId = auth.user._id;
  const onlySiteId = installedSiteId(auth);

  server.registerTool(
    "list_sites",
    {
      description: "List websites owned by the authenticated account.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
    },
    async ({ limit }) => {
      if (!hasScope(auth, "sites:read")) return scopeError("sites:read");
      const page = await sitesService.listSites({
        ownerId,
        limit: limit || 20,
        cursor: null,
        onlySiteId,
      });
      return textResult({ sites: page.sites, hasMore: page.hasMore, nextCursor: page.nextCursor });
    }
  );

  server.registerTool(
    "get_site",
    {
      description: "Fetch one website owned by the authenticated account.",
      inputSchema: { siteId: z.string() },
    },
    async ({ siteId }) => {
      if (!hasScope(auth, "sites:read")) return scopeError("sites:read");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      const site = await sitesService.getSite({ ownerId, siteId });
      if (!site) return { isError: true, content: [{ type: "text", text: "not_found" }] };
      return textResult(site);
    }
  );

  server.registerTool(
    "get_business_profile",
    {
      description: "Read the published business profile for an owned site.",
      inputSchema: { siteId: z.string().optional() },
    },
    async ({ siteId }) => {
      if (!hasScope(auth, "profile:read")) return scopeError("profile:read");
      if (onlySiteId && siteId && String(siteId) !== onlySiteId) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      const profile = await sitesService.getBusinessProfile({
        ownerId,
        siteId: onlySiteId || siteId,
      });
      if (!profile) return { isError: true, content: [{ type: "text", text: "not_found" }] };
      return textResult(profile);
    }
  );

  server.registerTool(
    "get_lead",
    {
      description: "Fetch one lead captured on a site owned by the authenticated account. The email is exactly as submitted.",
      inputSchema: { leadId: z.string() },
    },
    async ({ leadId }) => {
      if (!hasScope(auth, "leads:read")) return scopeError("leads:read");
      const lead = await leadsService.getLead({
        ownerId,
        leadId,
        siteId: auth.siteId || null,
      });
      if (!lead) return { isError: true, content: [{ type: "text", text: "not_found" }] };
      return textResult(lead);
    }
  );

  server.registerTool(
    "list_webhooks",
    {
      description: "List webhook subscriptions for the authenticated account. Secrets are omitted.",
      inputSchema: {},
    },
    async () => {
      if (!hasScope(auth, "webhooks:write")) return scopeError("webhooks:write");
      const data = await listEndpoints(ownerId, { installationId: auth.installationId || null });
      return textResult({ webhooks: data });
    }
  );
}

async function handleMcp(req, res) {
  const server = new McpServer({ name: "findvirtualme", version: "1.0.0" });
  registerTools(server, req.publicApi);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (_err) {
    console.error("mcp_request_error");
    if (!res.headersSent) res.status(500).json({ error: { code: "internal_error", message: "Internal server error" } });
  } finally {
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  }
}

function mountMcp(app) {
  const router = express.Router();
  router.post("/", authenticateApiKey, publicApiRateLimit, handleMcp);
  app.use("/api/mcp", router);
}

module.exports = {
  mountMcp,
};
