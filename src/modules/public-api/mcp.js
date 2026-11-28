const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const express = require("express");
const { authenticateMcpRequest } = require("./mcpAuth.middleware");
const { publicApiRateLimit } = require("./rateLimit");
const sitesService = require("./sites.service");
const leadsService = require("./leads.service");
const { listEndpoints } = require("./webhook.service");
const componentService = require("../portfolios/component.service");
const siteTools = require("./siteTools.service");
const { isMcpSiteToolsEnabled } = require("../../shared/config/mcpSiteTools");

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

function toolErrorPayload(err) {
  const code = err.code || "internal_error";
  const message = err.message || "Request failed";
  const payload = { code, message };
  if (err.details && typeof err.details === "object") payload.details = err.details;
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
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
    "list_components",
    {
      description:
        "List reusable feature components available for a site's template (requires FEATURE_COMPONENTS_ENABLED).",
      inputSchema: { siteId: z.string() },
    },
    async ({ siteId }) => {
      if (!hasScope(auth, "sites:read")) return scopeError("sites:read");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const listed = await componentService.listAvailableComponents({
          ownerId,
          siteId,
          audience: "mcp",
        });
        if (!listed) return { isError: true, content: [{ type: "text", text: "not_found" }] };
        return textResult(listed);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "add_component",
    {
      description:
        "Add a feature component to the site draft (requires SITE_DRAFTS_ENABLED and sites:write).",
      inputSchema: {
        siteId: z.string(),
        type: z.string(),
        props: z.record(z.unknown()).optional(),
        order: z.number().int().min(0).optional(),
      },
    },
    async ({ siteId, type, props, order }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const result = await componentService.addComponent(
          componentService.buildExternalWriteContext(auth, siteId),
          { type, props, order }
        );
        return textResult(result);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "update_component",
    {
      description: "Update a feature component section in the site draft.",
      inputSchema: {
        siteId: z.string(),
        sectionId: z.string(),
        props: z.record(z.unknown()),
      },
    },
    async ({ siteId, sectionId, props }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const result = await componentService.updateComponent(
          componentService.buildExternalWriteContext(auth, siteId),
          { sectionId, props }
        );
        return textResult(result);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "remove_component",
    {
      description: "Remove a feature component section from the site draft.",
      inputSchema: { siteId: z.string(), sectionId: z.string() },
    },
    async ({ siteId, sectionId }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const result = await componentService.removeComponent(
          componentService.buildExternalWriteContext(auth, siteId),
          { sectionId }
        );
        return textResult(result);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "reorder_components",
    {
      description: "Reorder feature component sections within the site draft.",
      inputSchema: {
        siteId: z.string(),
        sectionIds: z.array(z.string()).min(1),
      },
    },
    async ({ siteId, sectionIds }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const result = await componentService.reorderComponents(
          componentService.buildExternalWriteContext(auth, siteId),
          { sectionIds }
        );
        return textResult(result);
      } catch (err) {
        return toolErrorPayload(err);
      }
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

  if (isMcpSiteToolsEnabled()) {
    registerSiteTools(server, auth, { ownerId, onlySiteId });
  }
}

function registerSiteTools(server, auth, ctx) {
  const { ownerId, onlySiteId } = ctx;

  server.registerTool(
    "create_site",
    {
      description:
        "Create a new site from a unified template (projectManager, dataScientist, agent, healthcare, handyman).",
      inputSchema: {
        template: z.string(),
        title: z.string().optional(),
      },
    },
    async ({ template, title }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId) {
        return toolErrorPayload(
          new siteTools.SiteToolsError(
            403,
            "forbidden",
            "Site-scoped tokens cannot create new sites"
          )
        );
      }
      try {
        const data = await siteTools.createSite({ ownerId, template, title });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "get_site_content",
    {
      description: "Read editable core sections for an owned site (summary, about, experience, skills, projects, education, contact, resumeUrl).",
      inputSchema: { siteId: z.string() },
    },
    async ({ siteId }) => {
      if (!hasScope(auth, "sites:read")) return scopeError("sites:read");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const data = await siteTools.getSiteContent({ ownerId, siteId });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "update_site_content",
    {
      description: "Update core site sections on the working draft (validated per template).",
      inputSchema: {
        siteId: z.string(),
        content: z.record(z.unknown()),
      },
    },
    async ({ siteId, content }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const data = await siteTools.updateSiteContent({
          ownerId,
          siteId,
          content,
          source: "mcp",
        });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "update_site_settings",
    {
      description: "Update site title, slug, visibility, and theme tokens when supported.",
      inputSchema: {
        siteId: z.string(),
        settings: z.record(z.unknown()),
      },
    },
    async ({ siteId, settings }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const data = await siteTools.updateSiteSettings({
          ownerId,
          siteId,
          settings,
          source: "mcp",
        });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "submit_for_publish",
    {
      description: "Mark the site draft as pending owner approval before going live.",
      inputSchema: { siteId: z.string() },
    },
    async ({ siteId }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const data = await siteTools.submitForPublish({ ownerId, siteId, source: "mcp" });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "publish_site",
    {
      description: "Publish the approved site draft (owner token with sites:write).",
      inputSchema: { siteId: z.string() },
    },
    async ({ siteId }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const data = await siteTools.publishSite({ ownerId, siteId });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "list_versions",
    {
      description: "List saved version history for an owned site (newest first).",
      inputSchema: { siteId: z.string() },
    },
    async ({ siteId }) => {
      if (!hasScope(auth, "sites:read")) return scopeError("sites:read");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const data = await siteTools.listSiteVersions({ ownerId, siteId });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
    }
  );

  server.registerTool(
    "revert_version",
    {
      description: "Load a historical version into the working draft without publishing.",
      inputSchema: {
        siteId: z.string(),
        versionNumber: z.number().int().min(1),
      },
    },
    async ({ siteId, versionNumber }) => {
      if (!hasScope(auth, "sites:write")) return scopeError("sites:write");
      if (onlySiteId && onlySiteId !== String(siteId)) {
        return { isError: true, content: [{ type: "text", text: "not_found" }] };
      }
      try {
        const data = await siteTools.revertSiteVersion({
          ownerId,
          siteId,
          versionNumber,
          source: "mcp",
        });
        return textResult(data);
      } catch (err) {
        return toolErrorPayload(err);
      }
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
  router.get("/", (_req, res) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({
        error: { code: "method_not_allowed", message: "MCP requests must use POST" },
      });
  });
  router.post("/", authenticateMcpRequest, publicApiRateLimit, handleMcp);
  app.use("/api/mcp", router);
}

module.exports = {
  mountMcp,
};
