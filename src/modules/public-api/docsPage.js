function renderDocsPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FindVirtualMe Public API</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font: 16px/1.5 Georgia, "Iowan Old Style", serif; color: #1c1917; background: #faf7f2; }
    main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1, h2 { font-family: "Palatino Linotype", Palatino, serif; line-height: 1.2; }
    h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.25rem; margin-top: 2rem; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
    code { background: #efeae2; padding: 0.1em 0.35em; border-radius: 0.25rem; }
    pre { background: #1c1917; color: #faf7f2; padding: 1rem; overflow: auto; border-radius: 0.5rem; }
    a { color: #9a3412; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { text-align: left; vertical-align: top; padding: 0.45rem 0.5rem; border-bottom: 1px solid #e7e0d6; }
    .lede { font-size: 1.05rem; }
  </style>
</head>
<body>
  <main>
    <h1>FindVirtualMe Public API</h1>
    <p class="lede">Version 1 lets an account key or an installed app read that account's sites and published business profile, list leads, update safe site copy, and subscribe to signed events. The machine-readable contract is the <a href="/api/public/v1/openapi.json">OpenAPI 3.1 document</a>.</p>

    <h2>Authentication</h2>
    <p>Public API v1 is dated <code>2026-10-23</code>. Send that value in the <code>Version</code> header. A different value is rejected. The path <code>/api/public/v1</code> is the same version.</p>
    <p>Send a developer API key or an installed-app access token on every data request:</p>
    <pre>Authorization: Bearer fvm_...</pre>
    <p>Account keys are created by the account owner with their FindVirtualMe session. The full secret is returned once at creation and stored only as a hash. Installed apps receive an access token that starts with <code>fvm_at_</code>. Either credential can access only the account that authorized it.</p>

    <h2>Account key lifecycle</h2>
    <p>These routes use the existing session token, not an API key.</p>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td>POST</td><td><code>/api/developer/api-keys</code></td><td>Create a key. Body: <code>name</code> (optional), <code>scopes</code>.</td></tr>
        <tr><td>GET</td><td><code>/api/developer/api-keys</code></td><td>List keys. Secrets are omitted. Prefix, scopes, last use, and revocation are included.</td></tr>
        <tr><td>DELETE</td><td><code>/api/developer/api-keys/:id</code></td><td>Revoke a key. Revoked keys stop working immediately.</td></tr>
        <tr><td>POST</td><td><code>/api/developer/api-keys/:id/rotate</code></td><td>Revoke the key and return a new secret with the same name and scopes.</td></tr>
      </tbody>
    </table>

    <h2>Scopes</h2>
    <ul>
      <li><code>sites:read</code> — list and fetch the caller's websites.</li>
      <li><code>profile:read</code> — read the published business profile.</li>
      <li><code>leads:read</code> — list form leads saved for the caller's sites.</li>
      <li><code>sites:write</code> — update safe text fields on an owned site.</li>
      <li><code>webhooks:write</code> — register and remove signed webhook subscriptions.</li>
      <li><code>custom_fields:read</code> and <code>custom_fields:write</code> — list or manage custom fields on an installed site.</li>
      <li><code>workflows:read</code> and <code>workflows:write</code> — list or manage workflow actions and triggers on an installed site.</li>
    </ul>
    <p><code>GET /me</code> identifies the key's account and does not require a resource scope. It returns the account id, username, role, active flag, and creation time.</p>

    <h2>Public resources</h2>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Scope</th></tr></thead>
      <tbody>
        <tr><td>GET</td><td><code>/api/public/v1/me</code></td><td>any valid key</td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/sites</code></td><td><code>sites:read</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/sites/:id</code></td><td><code>sites:read</code></td></tr>
        <tr><td>PATCH</td><td><code>/api/public/v1/sites/:id/content</code></td><td><code>sites:write</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/business-profile</code></td><td><code>profile:read</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/leads</code></td><td><code>leads:read</code></td></tr>
        <tr><td>DELETE</td><td><code>/api/public/v1/installation</code></td><td>installed app token</td></tr>
        <tr><td>POST, GET</td><td><code>/api/public/v1/webhooks</code></td><td><code>webhooks:write</code></td></tr>
        <tr><td>DELETE</td><td><code>/api/public/v1/webhooks/:id</code></td><td><code>webhooks:write</code></td></tr>
      </tbody>
    </table>
    <p><code>PATCH /sites/:id/content</code> accepts <code>field</code> and <code>value</code>. <code>field=title</code> updates the site title. Other fields require <code>sectionId</code> and must be a published hero or summary text field. Values are plain text of at most 200 characters and cannot include contact details or links.</p>
    <p><code>GET /leads</code> returns id, site id, name, email, message, and created time for contact forms on sites the caller owns. It uses the same cursor pagination as <code>GET /sites</code>.</p>
    <p>Sites include subdomain, platform hostname, custom domains, and published status. <code>GET /sites</code> accepts <code>limit</code> (1–100, default 20) and an opaque <code>cursor</code>. The page object includes <code>nextCursor</code> and <code>hasMore</code>.</p>
    <p><code>GET /business-profile</code> reads the caller's published site (or <code>?siteId=</code>). It returns business name, logo URL, brand colors, and address taken from the site. It does not return account email, phone, or other private contact fields. Pass <code>siteId</code> to choose a specific owned site.</p>

    <h2>Errors and limits</h2>
    <p>Errors use <code>{ "error": { "code": "...", "message": "..." } }</code>. Unknown and revoked keys both return <code>invalid_api_key</code>. A missing scope returns <code>insufficient_scope</code>. Another customer's site id returns <code>not_found</code>.</p>
    <p>Each key has a fixed window stored in MongoDB, so the limit is shared by every app instance. Defaults are 60 requests per 60 seconds. <code>429</code> responses use code <code>rate_limited</code> and include <code>Retry-After</code>. Successful responses include <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code>, and <code>RateLimit-Reset</code>.</p>

    <h2>Webhooks</h2>
    <p>Register an https endpoint with a session, with an API key that has <code>webhooks:write</code>, or with an installed app access token that has <code>webhooks:write</code>. The signing secret is returned once. An app can also set <code>webhookUrl</code> when it is registered. Each install then subscribes that URL to the full event catalog and signs deliveries with the app signing secret returned once at registration. Event catalog: <code>lead.captured</code>, <code>site.published</code>, <code>business_profile.updated</code>, <code>form.submitted</code>, <code>app.installed</code>, <code>app.uninstalled</code>, and <code>workflow.trigger.fired</code>.</p>
    <p>Each delivery sends the raw JSON body and these headers:</p>
    <pre>X-FindVirtualMe-Timestamp: &lt;unix seconds&gt;
X-FindVirtualMe-Signature: v1=&lt;hex&gt;
X-FindVirtualMe-Event: &lt;event id&gt;</pre>
    <p><code>v1</code> is HMAC-SHA256 of the UTF-8 string <code>&#36;{timestamp}.&#36;{rawBody}</code> using the signing secret. <code>timestamp</code> is the header value and <code>rawBody</code> is the exact JSON body. Compare in constant time. Reject timestamps more than 300 seconds from your clock. Dedupe on <code>id</code> in the JSON. Retries send the same <code>id</code> and a new timestamp. Failed deliveries wait 5 seconds, 30 seconds, 2 minutes, 10 minutes, then 1 hour, and stop after 6 attempts. The OpenAPI document's <code>webhooks</code> section is the payload contract.</p>

    <h2>Marketplace</h2>
    <p>A developer registers an app with <code>POST /api/developer/apps</code>. Optional <code>webhookUrl</code> is the app-level https endpoint for install, uninstall, and resource events. An admin approves it with <code>POST /api/admin/apps/:id/review</code>. Approved apps are listed at <code>GET /api/marketplace/apps</code>. The site owner starts install at <code>GET /api/oauth/authorize?response_type=code</code>. Without <code>site_id</code> the response lists the owner's sites. With <code>site_id</code> the browser is redirected to the app with <code>code</code>. <code>POST /api/oauth/authorize</code> returns the same code as JSON. Both require <code>code_challenge_method=S256</code>. The app exchanges the code at <code>POST /api/oauth/token</code> using JSON or <code>application/x-www-form-urlencoded</code>, then refreshes it. Access tokens last one hour, are scoped to the installed site, and include <code>site_id</code>. <code>DELETE /api/developer/installations/:id</code> or <code>DELETE /api/public/v1/installation</code> revokes tokens and emits <code>app.uninstalled</code>.</p>
    <p>An installed app with <code>custom_fields:write</code> registers fields on its site at <code>POST /api/public/v1/sites/:id/custom-fields</code>. With <code>workflows:write</code> it registers actions at <code>POST /api/public/v1/sites/:id/workflow-actions</code> and triggers at <code>POST /api/public/v1/sites/:id/workflow-triggers</code>. Firing a trigger emits <code>workflow.trigger.fired</code>. Executing an action POSTs a signed event to the action's <code>targetUrl</code>.</p>

    <h2>MCP</h2>
    <p>Streamable HTTP is at <code>POST /api/mcp</code>. Send the same bearer API key. Tools: <code>list_sites</code>, <code>get_site</code>, <code>get_business_profile</code>, <code>list_leads</code>, <code>update_site_content</code>, and <code>list_integrations</code>. Each tool uses the key's scopes.</p>
    <pre>{
  "mcpServers": {
    "findvirtualme": {
      "url": "https://findvirtual.me/api/mcp",
      "headers": {
        "Authorization": "Bearer fvm_..."
      }
    }
  }
}</pre>
  </main>
</body>
</html>`;
}

module.exports = { renderDocsPage };
