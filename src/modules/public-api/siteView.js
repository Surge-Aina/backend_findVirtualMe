const DNS_LABEL = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/;

function platformHost() {
  const raw = (process.env.PUBLIC_SITE_HOST || "findvirtual.me").trim().toLowerCase();
  const host = raw.replace(/^\.+|\.+$/g, "").replace(/^https?:\/\//, "").split("/")[0];
  return host || "findvirtual.me";
}

function toPublicSite(portfolio, domains) {
  const slug = typeof portfolio.slug === "string" ? portfolio.slug.trim().toLowerCase() : "";
  const subdomain = slug || null;
  const host = platformHost();
  return {
    id: portfolio._id.toString(),
    title: typeof portfolio.title === "string" ? portfolio.title : "",
    template: portfolio.template || null,
    subdomain,
    hostname: subdomain && DNS_LABEL.test(subdomain) ? `${subdomain}.${host}` : null,
    published: portfolio.visibility === "public",
    domains: Array.isArray(domains) ? domains : [],
  };
}

module.exports = {
  platformHost,
  toPublicSite,
};
