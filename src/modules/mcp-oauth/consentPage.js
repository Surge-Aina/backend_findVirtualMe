const { MCP_OAUTH_CONSENT_SCOPES } = require("../../shared/config/mcpOAuth");

const SCOPE_LABELS = {
  "sites:read": "Read your websites",
  "profile:read": "Read published business profiles",
  "leads:read": "Read captured leads",
  "sites:write": "Edit site drafts (components)",
};

const WEB_LOGIN_HINT =
  "Sign in at findvirtual.me first with your usual sign-in method, then return here and retry authorization.";

function renderConsentPage({ ticket, csrfToken, clientName, requestedScopes, loggedIn, username, error }) {
  const choices = requestedScopes.length ? requestedScopes : [...MCP_OAUTH_CONSENT_SCOPES];
  const scopeInputs = choices
    .map(
      (scope) =>
        `<label class="scope"><input type="checkbox" name="scopes" value="${scope}" checked> <span><code>${scope}</code> — ${SCOPE_LABELS[scope] || scope}</span></label>`
    )
    .join("\n");

  const loginBlock = loggedIn
    ? `<p class="lede">Signed in as <strong>${escapeHtml(username || "account")}</strong>.</p>`
    : `<fieldset class="login">
        <legend>Sign in to FindVirtualMe</legend>
        <label>Email <input type="email" name="email" autocomplete="username" /></label>
        <label>Password <input type="password" name="password" autocomplete="current-password" /></label>
       </fieldset>`;

  const errorBlock = error
    ? `<p class="error" role="alert">${escapeHtml(error)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize MCP access · FindVirtualMe</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font: 16px/1.5 Georgia, "Iowan Old Style", serif; color: #1c1917; background: #faf7f2; }
    main { max-width: 36rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-family: "Palatino Linotype", Palatino, serif; font-size: 1.75rem; line-height: 1.2; }
    .lede { font-size: 1.05rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; background: #efeae2; padding: 0.1em 0.35em; border-radius: 0.25rem; }
    .scope { display: block; margin: 0.65rem 0; }
    .login label { display: block; margin: 0.5rem 0; }
    .login input { width: 100%; max-width: 24rem; padding: 0.35rem 0.5rem; font: inherit; }
    button { margin-top: 1.25rem; background: #9a3412; color: #faf7f2; border: 0; border-radius: 0.35rem; padding: 0.55rem 1.1rem; font: inherit; cursor: pointer; }
    .error { color: #9a3412; }
  </style>
</head>
<body>
  <main>
    <h1>Connect ${escapeHtml(clientName || "an app")}</h1>
    <p class="lede">This application wants access to your FindVirtualMe account through MCP.</p>
    ${errorBlock}
    ${loginBlock}
    <form method="post" action="/mcp-oauth/consent">
      <input type="hidden" name="ticket" value="${escapeHtml(ticket)}">
      <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}">
      <h2>Choose scopes</h2>
      ${scopeInputs}
      <button type="submit">${loggedIn ? "Allow access" : "Sign in and allow"}</button>
    </form>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { renderConsentPage, SCOPE_LABELS, WEB_LOGIN_HINT };