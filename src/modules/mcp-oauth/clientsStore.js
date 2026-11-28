const McpOAuthClient = require("./models/mcpOAuthClient.model");
const { hashKey } = require("../public-api/apiKey.service");
const { isAllowedMcpOAuthRedirect } = require("./redirectAllowlist");
const { fetchClientMetadataDocument } = require("./metadataFetch");
const {
  InvalidClientMetadataError,
  CustomOAuthError,
} = require("@modelcontextprotocol/sdk/server/auth/errors.js");

function isMetadataClientId(clientId) {
  if (typeof clientId !== "string") return false;
  try {
    const url = new URL(clientId);
    return url.protocol === "https:" && !!url.pathname && url.pathname !== "/";
  } catch (_err) {
    return false;
  }
}

function toSdkClient(doc) {
  const isPublic = !doc.clientSecretHash || doc.tokenEndpointAuthMethod === "none";
  return {
    client_id: doc.clientId,
    client_name: doc.clientName || "MCP client",
    redirect_uris: [...doc.redirectUris],
    grant_types: doc.grantTypes?.length ? [...doc.grantTypes] : ["authorization_code", "refresh_token"],
    response_types: doc.responseTypes?.length ? [...doc.responseTypes] : ["code"],
    token_endpoint_auth_method: isPublic ? "none" : doc.tokenEndpointAuthMethod || "client_secret_post",
    client_secret: undefined,
    client_secret_expires_at: 0,
  };
}

function filterRedirectUris(uris) {
  if (!Array.isArray(uris)) return [];
  const out = [];
  for (const uri of uris) {
    if (!isAllowedMcpOAuthRedirect(uri)) continue;
    const normalized = new URL(uri).href;
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}

function assertRegistrationRedirects(uris) {
  if (!Array.isArray(uris) || uris.length === 0) {
    throw new CustomOAuthError("invalid_redirect_uri", "At least one allowed redirect_uri is required");
  }
  for (const uri of uris) {
    if (!isAllowedMcpOAuthRedirect(uri)) {
      throw new CustomOAuthError("invalid_redirect_uri", "redirect_uri is not allowed for MCP OAuth");
    }
  }
}

async function fetchMetadataClient(clientId) {
  const body = await fetchClientMetadataDocument(clientId);
  if (!body || typeof body !== "object") return null;
  if (body.client_id !== clientId) return null;
  const redirectUris = filterRedirectUris(body.redirect_uris);
  if (redirectUris.length === 0) return null;

  const client = {
    client_id: clientId,
    client_name: typeof body.client_name === "string" ? body.client_name : "MCP client",
    redirect_uris: redirectUris,
    grant_types: Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code"],
    response_types: Array.isArray(body.response_types) ? body.response_types : ["code"],
    token_endpoint_auth_method: "none",
  };

  await McpOAuthClient.findOneAndUpdate(
    { clientId },
    {
      clientId,
      clientName: client.client_name,
      redirectUris,
      tokenEndpointAuthMethod: "none",
      source: "metadata",
      metadataUrl: clientId,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return client;
}

class McpOAuthClientsStore {
  async getClient(clientId) {
    if (isMetadataClientId(clientId)) {
      try {
        return await fetchMetadataClient(clientId);
      } catch (_err) {
        return undefined;
      }
    }
    const doc = await McpOAuthClient.findOne({ clientId, revokedAt: null }).lean();
    if (!doc) return undefined;
    return toSdkClient(doc);
  }

  async registerClient(clientMetadata) {
    assertRegistrationRedirects(clientMetadata.redirect_uris);
    const redirectUris = filterRedirectUris(clientMetadata.redirect_uris);
    if (redirectUris.length === 0) {
      throw new CustomOAuthError("invalid_redirect_uri", "No allowed redirect_uri values were provided");
    }
    const isPublic = clientMetadata.token_endpoint_auth_method === "none" || !clientMetadata.client_secret;
    const clientSecret = isPublic ? undefined : clientMetadata.client_secret;
    const clientId = clientMetadata.client_id;

    if (!clientId) {
      throw new InvalidClientMetadataError("client_id is required");
    }

    await McpOAuthClient.create({
      clientId,
      clientSecretHash: clientSecret ? hashKey(clientSecret) : "",
      clientName: clientMetadata.client_name || "MCP client",
      redirectUris,
      tokenEndpointAuthMethod: isPublic ? "none" : clientMetadata.token_endpoint_auth_method || "client_secret_post",
      grantTypes: clientMetadata.grant_types || ["authorization_code", "refresh_token"],
      responseTypes: clientMetadata.response_types || ["code"],
      source: "dcr",
    });

    return {
      ...clientMetadata,
      client_id: clientId,
      redirect_uris: redirectUris,
      client_secret: clientSecret,
      client_secret_expires_at: isPublic ? undefined : clientMetadata.client_secret_expires_at,
      token_endpoint_auth_method: isPublic ? "none" : clientMetadata.token_endpoint_auth_method,
    };
  }
}

module.exports = {
  McpOAuthClientsStore,
  isMetadataClientId,
  filterRedirectUris,
  assertRegistrationRedirects,
};