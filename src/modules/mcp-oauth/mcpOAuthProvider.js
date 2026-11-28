const { McpOAuthClientsStore } = require("./clientsStore");
const {
  createPendingAuthorization,
  challengeForAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  revokeToken,
  verifyAccessTokenForSdk,
} = require("./mcpOAuth.service");
const { mcpResourceUrl } = require("../../shared/config/mcpOAuth");

class FindVirtualMeMcpOAuthProvider {
  constructor() {
    this.clientsStore = new McpOAuthClientsStore();
  }

  async authorize(client, params, res) {
    const { ticket } = await createPendingAuthorization({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      requestedScopes: params.scopes,
      codeChallenge: params.codeChallenge,
      state: params.state,
      resource: params.resource ? params.resource.href : mcpResourceUrl().href,
    });
    res.redirect(302, `/mcp-oauth/consent?ticket=${encodeURIComponent(ticket)}`);
  }

  async challengeForAuthorizationCode(client, authorizationCode) {
    return challengeForAuthorizationCode(client.client_id, authorizationCode);
  }

  async exchangeAuthorizationCode(client, authorizationCode, codeVerifier, redirectUri, resource) {
    return exchangeAuthorizationCode({
      clientId: client.client_id,
      code: authorizationCode,
      codeVerifier,
      redirectUri,
      resource: resource ? resource.href : undefined,
    });
  }

  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    return exchangeRefreshToken({
      clientId: client.client_id,
      refreshToken,
      scopes,
      resource: resource ? resource.href : undefined,
    });
  }

  async verifyAccessToken(token) {
    return verifyAccessTokenForSdk(token);
  }

  async revokeToken(client, request) {
    await revokeToken({
      clientId: client.client_id,
      token: request.token,
      tokenTypeHint: request.token_type_hint,
    });
  }
}

module.exports = { FindVirtualMeMcpOAuthProvider };