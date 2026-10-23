const dns = require("dns");
const https = require("https");
const {
  assertPublicHttpsUrl,
  isBlockedIp,
  postWebhook,
  resetWebhookTransport,
} = require("../webhookUrls");

describe("webhook URL guard", () => {
  afterEach(() => {
    resetWebhookTransport();
    jest.restoreAllMocks();
  });

  it("blocks private, link-local, metadata, and mapped addresses", () => {
    const blocked = [
      "127.0.0.1",
      "10.0.0.1",
      "0.0.0.0",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.1.1",
      "100.64.0.1",
      "100.100.100.200",
      "224.0.0.1",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "fe90::1",
      "febf::1",
      "fec0::1",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "::ffff:a9fe:a9fe",
      "64:ff9b::7f00:1",
      "2002:a9fe:a9fe::",
    ];
    for (const address of blocked) {
      expect(isBlockedIp(address)).toBe(true);
    }
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);

    expect(() => assertPublicHttpsUrl("https://[::1]/hook")).toThrow(/not allowed/);
    expect(() => assertPublicHttpsUrl("https://[::ffff:169.254.169.254]/latest")).toThrow(
      /not allowed/
    );
    expect(() => assertPublicHttpsUrl("https://metadata.google.internal./")).toThrow(/not allowed/);
    expect(() => assertPublicHttpsUrl("https://169.254.169.254/")).toThrow(/not allowed/);
    expect(() => assertPublicHttpsUrl("http://hooks.example.test/hook")).toThrow(/https/);
    expect(() => assertPublicHttpsUrl("https://user:pass@hooks.example.test/hook")).toThrow(
      /credentials/
    );
    expect(assertPublicHttpsUrl("https://hooks.example.test/inbound")).toBe(
      "https://hooks.example.test/inbound"
    );
  });

  it("does not connect when DNS returns a private address and does not follow redirects", async () => {
    const lookup = jest.spyOn(dns.promises, "lookup").mockResolvedValue([
      { address: "10.1.2.3", family: 4 },
    ]);
    const request = jest.spyOn(https, "request");

    await expect(postWebhook("https://hooks.example.test/inbound", { headers: {}, body: "{}" })).rejects.toThrow(
      /not allowed/
    );
    expect(request).not.toHaveBeenCalled();

    lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    request.mockImplementation((_options, callback) => {
      const req = {
        on() {
          return req;
        },
        destroy() {},
        end() {
          callback({ statusCode: 302, resume() {} });
        },
      };
      return req;
    });

    const response = await postWebhook("https://hooks.example.test/inbound", {
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(302);
    expect(request).toHaveBeenCalledTimes(1);
    const options = request.mock.calls[0][0];
    expect(options.hostname).toBe("hooks.example.test");
    expect(options.lookup).toEqual(expect.any(Function));
    const pinned = await new Promise((resolve, reject) => {
      options.lookup("hooks.example.test", {}, (err, address, family) => {
        if (err) reject(err);
        else resolve({ address, family });
      });
    });
    expect(pinned).toEqual({ address: "8.8.8.8", family: 4 });
  });
});
