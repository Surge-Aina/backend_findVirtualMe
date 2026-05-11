const mockUploadStream = jest.fn();

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn((opts, cb) => {
        const stream = { end: (buf) => mockUploadStream(opts, cb, buf) };
        return stream;
      }),
    },
  },
}));

const { uploadToCloudinary } = require("../cloudinaryService");

describe("cloudinaryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadStream.mockImplementation((opts, cb, buf) => {
      cb(null, { public_id: "pid" });
    });
  });

  it("uploads buffer via stream", async () => {
    const result = await uploadToCloudinary(Buffer.from("img"));

    expect(result).toEqual({ public_id: "pid" });
  });

  it("rejects on upload error", async () => {
    mockUploadStream.mockImplementation((opts, cb, buf) => {
      cb(new Error("fail"));
    });

    await expect(uploadToCloudinary(Buffer.from("x"))).rejects.toThrow("fail");
  });
});
