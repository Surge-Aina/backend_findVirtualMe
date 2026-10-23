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
    <p class="lede">Version 1 is a read API for a customer's own sites and published business profile. The machine-readable contract is the <a href="/api/public/v1/openapi.json">OpenAPI 3.1 document</a>.</p>

    <h2>Authentication</h2>
    <p>Send the developer API key on every data request:</p>
    <pre>Authorization: Bearer fvm_...</pre>
    <p>Keys are created by the account owner with their FindVirtualMe session. The full secret is returned once at creation and stored only as a hash. A key can read only that owner's data.</p>

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
      <li><code>webhooks:write</code> — create, list, delete, rotate, and test webhook subscriptions.</li>
      <li><code>leads:read</code> — read one lead captured on a site the caller owns.</li>
    </ul>
    <p><code>GET /me</code> identifies the key's account and does not require a resource scope. It returns the account id, username, role, active flag, and creation time.</p>

    <h2>Public resources</h2>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Scope</th></tr></thead>
      <tbody>
        <tr><td>GET</td><td><code>/api/public/v1/me</code></td><td>any valid key</td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/sites</code></td><td><code>sites:read</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/sites/:id</code></td><td><code>sites:read</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/business-profile</code></td><td><code>profile:read</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/leads/:leadId</code></td><td><code>leads:read</code></td></tr>
        <tr><td>POST</td><td><code>/api/public/v1/webhooks</code></td><td><code>webhooks:write</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/webhooks</code></td><td><code>webhooks:write</code></td></tr>
        <tr><td>POST</td><td><code>/api/public/v1/webhooks/:id/rotate</code></td><td><code>webhooks:write</code></td></tr>
        <tr><td>POST</td><td><code>/api/public/v1/webhooks/:id/test</code></td><td><code>webhooks:write</code></td></tr>
        <tr><td>GET</td><td><code>/api/public/v1/webhooks/:id/deliveries</code></td><td><code>webhooks:write</code></td></tr>
        <tr><td>DELETE</td><td><code>/api/public/v1/webhooks/:id</code></td><td><code>webhooks:write</code></td></tr>
      </tbody>
    </table>
    <p>Sites include subdomain, platform hostname, custom domains, and published status. <code>GET /sites</code> accepts <code>limit</code> (1–100, default 20) and an opaque <code>cursor</code>. The page object includes <code>nextCursor</code> and <code>hasMore</code>.</p>
    <p><code>GET /business-profile</code> reads the caller's published site (or <code>?siteId=</code>). It returns business name, logo URL, brand colors, and address taken from the site. It does not return account email, phone, or other private contact fields. Pass <code>siteId</code> to choose a specific owned site.</p>

    <h2>Errors and limits</h2>
    <p>Errors use <code>{ "error": { "code": "...", "message": "..." } }</code>. Unknown and revoked keys both return <code>invalid_api_key</code>. A missing scope returns <code>insufficient_scope</code>. Another customer's site id returns <code>not_found</code>.</p>
    <p>Each key is counted in the database, so the limit is shared by every process. If that counter is unavailable, the process applies the same limit on its own. Defaults are 60 requests per 60 seconds. <code>429</code> responses use code <code>rate_limited</code> and include <code>Retry-After</code>. Successful responses include <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code>, and <code>RateLimit-Reset</code>.</p>

    <h2>Event contract</h2>
    <p>Every payload includes top-level <code>apiVersion</code> (<code>2026-10-23</code>). Deliveries also send <code>X-FindVirtualMe-Api-Version</code> with that value. <code>lead.captured</code> and <code>form.submitted</code> for one submission share <code>data.leadId</code>. <code>data.email</code> is the address exactly as the visitor submitted it. <code>data.consent</code> is <code>{"contact": true}</code> or <code>{"contact": false}</code> when the form includes the optional consent checkbox, and <code>null</code> when the form does not ask. Send <code>consentContact</code> as a boolean, or <code>consent</code> as a boolean or <code>{"contact": true}</code>. Omit both when the form does not ask.</p>
    <p>On <code>lead.captured</code>, <code>form.submitted</code>, <code>site.published</code>, and <code>business_profile.updated</code>, top-level <code>appId</code> and <code>installationId</code> identify the marketplace installation that owns the delivering subscription. Both are <code>null</code> for an account subscription. <code>GET /api/public/v1/leads/:leadId</code> returns that lead for a site the caller owns and omits the site owner's private contact fields.</p>
    <pre>{
  "id": "evt_example",
  "type": "lead.captured",
  "apiVersion": "2026-10-23",
  "createdAt": "2026-10-23T12:00:00.000Z",
  "appId": null,
  "installationId": null,
  "data": {
    "leadId": "507f1f77bcf86cd799439011",
    "siteId": "507f1f77bcf86cd799439012",
    "email": "Visitor@Example.TEST",
    "name": "Visitor Example",
    "phone": null,
    "consent": { "contact": true },
    "createdAt": "2026-10-23T12:00:00.000Z"
  }
}</pre>

    <h2>Signed webhooks</h2>
    <p>Account owners use <code>/api/developer/webhooks</code> with a session token. Apps use the same actions on <code>/api/public/v1/webhooks</code> with scope <code>webhooks:write</code>. Create, list, and delete subscriptions. <code>POST /:id/rotate</code> returns a new signing secret once. <code>POST /:id/test</code> sends one signed test event. <code>GET /:id/deliveries</code> is the delivery log and does not include the request body.</p>
    <p>Catalog: <code>lead.captured</code>, <code>form.submitted</code>, <code>site.published</code>, <code>business_profile.updated</code>, <code>app.installed</code>, <code>app.uninstalled</code>.</p>
    <p>Every attempt sends <code>X-FindVirtualMe-Timestamp</code> (unix seconds), <code>X-FindVirtualMe-Signature: v1=&lt;hex&gt;</code>, <code>X-FindVirtualMe-Event</code> (the event id), and <code>X-FindVirtualMe-Api-Version</code> (<code>2026-10-23</code>). The hex is HMAC-SHA256 of the timestamp, a period, and the exact JSON body, using the endpoint signing secret. Reject timestamps more than 300 seconds from your clock and compare the hex in constant time. The event id stays the same across retries. A new timestamp is used for each attempt. Retries wait 5 seconds, 30 seconds, 2 minutes, 10 minutes, and 1 hour, then stop after 6 attempts.</p>
    <p>Subscriber URLs must be public https. Private, link-local, and metadata addresses are rejected, including names that resolve to those addresses. Redirects are not followed.</p>

    <h2>Marketplace</h2>
    <p>An account registers an app at <code>POST /api/developer/apps</code>. An admin approves it with <code>POST /api/admin/apps/:id/review</code> before it appears in <code>GET /api/marketplace/apps</code>. Installation is an OAuth 2.0 authorization-code grant per site. <code>code_challenge_method</code> must be <code>S256</code>. Access tokens last one hour and refresh tokens last 30 days. Both rotate. A token can call only the site it was installed on. Installing emits <code>app.installed</code>. Uninstalling emits <code>app.uninstalled</code>. The app manages its own webhook subscriptions with the install token.</p>

    <h2>MCP</h2>
    <p><code>POST /api/mcp</code> speaks the Model Context Protocol. It uses the same API keys and scopes. Tools: <code>list_sites</code>, <code>get_site</code>, <code>get_business_profile</code>, <code>get_lead</code>, and <code>list_webhooks</code>. <code>get_lead</code> requires <code>leads:read</code>. A missing scope returns an error result and does not log the tool arguments.</p>
    <pre>{
  "mcpServers": {
    "findvirtualme": {
      "url": "https://findvirtual.me/api/mcp",
      "headers": { "Authorization": "Bearer fvm_..." }
    }
  }
}</pre>
  </main>
</body>
</html>`;
}

module.exports = { renderDocsPage };
