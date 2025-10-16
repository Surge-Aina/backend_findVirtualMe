describe("generateVendorAboutAndMenuJSON", () => {
  let generateVendorAboutAndMenuJSON;
  let mockCreate;

  beforeEach(() => {
    jest.resetModules();

    mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              vendor: { name: "Direct Test Vendor", email: "direct@test.com" },
              about: {
                banner: { title: "Direct About Us", description: "" },
                contentBlocks: [],
                gridImages: [],
              },
              menuItems: [
                {
                  name: "Unit Burger",
                  description: "Mock burger",
                  price: 4.99,
                },
              ],
            }),
          },
        },
      ],
    });

    jest.doMock("openai", () => {
      return function OpenAI() {
        return {
          chat: {
            completions: {
              create: mockCreate,
            },
          },
        };
      };
    });

    ({ generateVendorAboutAndMenuJSON } = require("../../../../services/openAiService"));
  });

  it("should return parsed vendor JSON from mocked OpenAI", async () => {
    const result = await generateVendorAboutAndMenuJSON("Test vendor description");

    expect(result.vendor.name).toBe("Direct Test Vendor");
    expect(result.about.banner.title).toBe("Direct About Us");
    expect(result.menuItems[0].name).toBe("Unit Burger");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.any(Array),
      })
    );
  });

  it("should throw error if OpenAI response is invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not-json" } }],
    });

    await expect(generateVendorAboutAndMenuJSON("bad text")).rejects.toThrow(SyntaxError);
  });

  // it("should throw error if OpenAI returns no choices", async () => {
  //   mockCreate.mockResolvedValueOnce({ choices: [] });

  //   await expect(
  //     generateVendorAboutAndMenuJSON("empty response")
  //   ).rejects.toThrow(/no choices/i);
  // });

  it("should throw error if OpenAI throws network error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Network failure"));

    await expect(generateVendorAboutAndMenuJSON("fail case")).rejects.toThrow(
      /Network failure/
    );
  });

  it("should handle when message.content is missing", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: {} }],
    });

    await expect(generateVendorAboutAndMenuJSON("bad format")).rejects.toThrow(
      /Cannot read properties/
    );
  });

  it("should pass vendor text into the prompt", async () => {
    const inputText = "Test vendor data goes here";
    await generateVendorAboutAndMenuJSON(inputText);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m) => m.role === "user");

    // Instead of strict equality
    expect(userMessage.content).toContain(inputText);
  });
});
