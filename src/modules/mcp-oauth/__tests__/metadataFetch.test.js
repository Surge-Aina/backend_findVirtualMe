const dns = require("dns");
const https = require("https");
const {
  fetchClientMetadataDocument,
  clearMetadataFetchCache,
} = require("../metadataFetch");
const { assertPublicHttpsUrl } = require("../../public-api/webhookUrls");

describe("client metadata fetch SSRF guard", () => {
  afterEach(() => {
    clearMetadataFetchCache();
    jest.restoreAllMocks();
  });

  it("rejects blocked client_id URLs using the webhook URL guard", () => {
    const blocked = [
      "https://127.0.0.1/client.json",
      "https://[::1]/client.json",
      "https://[::ffff:127.0.0.1]/client.json",
      "https://[::ffff:10.0.0.1]/client.json",
      "https://169.254.169.254/client.json",
      "https://[::ffff:169.254.169.254]/latest/metadata.json",
      "https://metadata.google.internal/client.json",
    ];
    for (const url of blocked) {
      expect(() => assertPublicHttpsUrl(url)).toThrow(/not allowed/);
    }
  });

  it("does not connect when DNS resolves to a private address", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);
    const request = jest.spyOn(https, "request");

    await expect(
      fetchClientMetadataDocument("https://connectors.example.test/oauth/client.json")
    ).rejects.toThrow(/not allowed/);
    expect(request).not.toHaveBeenCalled();
  });

  it("pins the resolved IP on the HTTPS connection", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const request = jest.spyOn(https, "request").mockImplementation((options, callback) => {
      const req = {
        on() {
          return req;
        },
        destroy() {},
        end() {
          callback({
            statusCode: 200,
            on(event, handler) {
              if (event === "data") {
                handler(
                  Buffer.from(
                    JSON.stringify({
                      client_id: "https://connectors.example.test/oauth/client.json",
                      client_name: "Example",
                      redirect_uris: ["https://claude.ai/callback"],
                    })
                  )
                );
              }
              if (event === "end") handler();
            },
          });
        },
      };
      return req;
    });

    const doc = await fetchClientMetadataDocument("https://connectors.example.test/oauth/client.json");
    expect(doc.client_name).toBe("Example");
    expect(request).toHaveBeenCalledTimes(1);
    const options = request.mock.calls[0][0];
    expect(options.hostname).toBe("connectors.example.test");
    expect(options.lookup).toEqual(expect.any(Function));
    const pinned = await new Promise((resolve, reject) => {
      options.lookup("connectors.example.test", {}, (err, address, family) => {
        if (err) reject(err);
        else resolve({ address, family });
      });
    });
    expect(pinned).toEqual({ address: "93.184.216.34", family: 4 });
  });

  it("rejects DNS answers that map to blocked IPv6-mapped IPv4 targets", async () => {
    jest
      .spyOn(dns.promises, "lookup")
      .mockResolvedValue([{ address: "::ffff:10.0.0.5", family: 6 }]);
    const request = jest.spyOn(https, "request");

    await expect(
      fetchClientMetadataDocument("https://connectors.example.test/oauth/client.json")
    ).rejects.toThrow(/not allowed/);
    expect(request).not.toHaveBeenCalled();
  });
});