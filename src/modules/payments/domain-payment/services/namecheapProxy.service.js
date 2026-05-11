const axios = require("axios");

const client = axios.create({
  baseURL: process.env.NAMECHEAP_PROXY_URL,
  headers: {
    "x-internal-key": process.env.NAMECHEAP_PROXY_KEY,
  },
  timeout: 30000,
});

exports.checkDomain = async (domain) => {
  const { data } = await client.post("namecheap/check", { domain });
  return data;
};

exports.registerDomain = async (payload) => {
  const { data } = await client.post("namecheap/register", payload);
  return data;
};

exports.getPricing = async () => {
  const { data } = await client.post("namecheap/pricing");
  return data;
};
