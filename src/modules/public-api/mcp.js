const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const express = require("express");
const { authenticateApiKey } = require("./publicApi.auth");
const { publicApiRateLimit } = require("./rateLimit");
const sitesService = require("./sites.service");
const { listLeads } = require("./leads.service");
const { updateSiteContent } = require("./siteContent");
const { listIntegrations } = require("./publicApi.controller");
const { parseLimit } = require("./cursor");

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

function registerTools(server, auth) {
  const ownerId = auth.user._id;

  server.registerTool(
    "list_sites",
    {
      description: "List websites owned by the authenticated account.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
    },
    async ({ limit }) => {
      if (!hasScope(auth, "sites:read")) return scopeError("sites:read");
      const page = await sitesService.listSites({ ownerId, limit: limit || 20, cursor: null });
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
      const profile = await sitesService.getBusinessProfile({ ownerId, siteId });
      if (!profile) return { isError: true, content: [{ type: "text", text: "not_found" }] };
      return textResult(profile);
    }
  );

  server.registerTool(
    "list_leads",
    {
      description: "List form leads for sites owned by the authenticated account.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
    },
    async ({ limit }) => {
      if (!hasScope(auth, "leads:read")) return scopeError("leads:read");
      const page = await listLeads({ ownerId, limit: limit || 20, cursor: null });
      return textResult(page);
    }
  );

  server.registerTool(
    "update_site_content",
    {
      description: "Update one safe text field on an owned site. Does not change visibility, slug, or contact fields.",
      inputSchema: {
        siteId: z.string(),
        field: z.string(),
        value: z.string(),
        sectionId: z.string().optional(),
      },
    },
    async (args) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      const updated = await updateSiteContent({ ownerId, ...args });
      return textResult(updated);
    }
  );

  server.registerTool(
    "list_integrations",
    {
      description: "List installed apps and webhook subscriptions for the authenticated account. Secrets are omitted.",
      inputSchema: {},
    },
    async () => textResult(await listIntegrations(ownerId))
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
  parseLimit,
};
