const mockUpload = jest.fn();
const mockUploadStream = jest.fn();
const mockDestroy = jest.fn();

jest.mock("../../../legacy/photographer/cloudinary-config", () => ({
  cloudinary: {
    uploader: {
      upload: (...args) => mockUpload(...args),
      upload_stream: (...args) => mockUploadStream(...args),
      destroy: (...args) => mockDestroy(...args),
    },
  },
}));

const {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadResume,
  uploadImage,
} = require("../cloudinaryUpload");

describe("cloudinaryUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploadToCloudinary uses upload_stream for Buffer", async () => {
    mockUploadStream.mockImplementation((opts, cb) => {
      const stream = { end: jest.fn() };
      setImmediate(() =>
        cb(null, {
          secure_url: "https://x",
          public_id: "pid",
          format: "jpg",
          bytes: 1,
          width: 1,
          height: 1,
        })
      );
      return stream;
    });

    const buf = Buffer.from([1, 2, 3]);
    const result = await uploadToCloudinary(buf, "f");

    expect(result.success).toBe(true);
    expect(result.url).toBe("https://x");
  });

  it("uploadToCloudinary handles stream error", async () => {
    mockUploadStream.mockImplementation((opts, cb) => {
      const stream = { end: jest.fn() };
      setImmediate(() => cb(new Error("up fail")));
      return stream;
    });

    const result = await uploadToCloudinary(Buffer.from("x"));
    expect(result.success).toBe(false);
    expect(result.error).toBe("up fail");
  });

  it("uploadToCloudinary uses upload for path string", async () => {
    mockUpload.mockResolvedValue({
      secure_url: "u",
      public_id: "p",
      format: "jpg",
      bytes: 1,
      width: 1,
      height: 1,
    });

    const result = await uploadToCloudinary("/path/to.jpg");

    expect(mockUpload).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("deleteFromCloudinary", async () => {
    mockDestroy.mockResolvedValue({ result: "ok" });

    const result = await deleteFromCloudinary("public-id");

    expect(result.success).toBe(true);
  });

  it("uploadResume delegates", async () => {
    mockUploadStream.mockImplementation((opts, cb) => {
      const stream = { end: jest.fn() };
      setImmediate(() =>
        cb(null, {
          secure_url: "u",
          public_id: "p",
          format: "pdf",
          bytes: 1,
        })
      );
      return stream;
    });

    await uploadResume(Buffer.from("pdf"), "owner");
    expect(mockUploadStream).toHaveBeenCalled();
  });

  it("uploadImage detects JPEG signature", async () => {
    mockUploadStream.mockImplementation((opts, cb) => {
      const stream = { end: jest.fn() };
      setImmediate(() =>
        cb(null, {
          secure_url: "u",
          public_id: "p",
          format: "jpg",
          bytes: 1,
          width: 1,
          height: 1,
        })
      );
      return stream;
    });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    await uploadImage(jpeg, "o", "cert");
    expect(mockUploadStream).toHaveBeenCalled();
  });
});
