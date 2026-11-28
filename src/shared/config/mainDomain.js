function getMainDomain() {
  const fromEnv = process.env.MAIN_DOMAIN;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return "findvirtual.me";
}

module.exports = {
  getMainDomain,
};