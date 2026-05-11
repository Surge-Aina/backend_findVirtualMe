const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((x) => x),
  DeleteObjectCommand: jest.fn().mockImplementation((x) => x),
  ListObjectsV2Command: jest.fn().mockImplementation((x) => x),
  DeleteObjectsCommand: jest.fn().mockImplementation((x) => x),
}));

jest.mock("uuid", () => ({ v4: () => "fixed-uuid" }));

const {
  uploadToS3,
  deleteFromS3,
  listByPrefix,
  deleteManyByPrefix,
  keyFromPublicUrl,
} = require("../s3Service");

describe("s3Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
    process.env.AWS_S3_BUCKET = "mybucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "k";
    process.env.AWS_SECRET_ACCESS_KEY = "s";
  });

  it("uploadToS3 sends PutObject and returns url", async () => {
    mockSend.mockResolvedValue({});

    const r = await uploadToS3(Buffer.from("a"), "f.txt", "text/plain", "pre");

    expect(r.key).toContain("pre/fixed-uuid.txt");
    expect(r.url).toContain("mybucket");
    expect(mockSend).toHaveBeenCalled();
  });

  it("deleteFromS3 sends DeleteObject", async () => {
    mockSend.mockResolvedValue({});

    await deleteFromS3("k1");

    expect(mockSend).toHaveBeenCalled();
  });

  it("listByPrefix paginates", async () => {
    mockSend
      .mockResolvedValueOnce({
        Contents: [{ Key: "a", LastModified: new Date() }],
        IsTruncated: true,
        NextContinuationToken: "t2",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "b", LastModified: new Date() }],
        IsTruncated: false,
      });

    const list = await listByPrefix("p/");

    expect(list).toHaveLength(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("deleteManyByPrefix batches deletes", async () => {
    mockSend
      .mockResolvedValueOnce({
        Contents: Array.from({ length: 3 }).map((_, i) => ({
          Key: `p/x${i}`,
        })),
        IsTruncated: false,
      })
      .mockResolvedValue({});

    const r = await deleteManyByPrefix("p/");

    expect(r.deleted).toBe(3);
  });

  it("deleteManyByPrefix returns 0 when empty", async () => {
    mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

    const r = await deleteManyByPrefix("empty/");

    expect(r.deleted).toBe(0);
  });

  it("keyFromPublicUrl matches virtual host style", () => {
    const url =
      "https://mybucket.s3.us-east-1.amazonaws.com/folder%2Ffile.jpg";
    expect(keyFromPublicUrl(url)).toBe("folder/file.jpg");
  });

  it("keyFromPublicUrl matches path-style bucket URL", () => {
    const url = "https://mybucket.s3.amazonaws.com/path/to/obj.png";
    expect(keyFromPublicUrl(url)).toBe("path/to/obj.png");
  });

  it("keyFromPublicUrl returns null for bad url", () => {
    expect(keyFromPublicUrl("not-url")).toBeNull();
    expect(keyFromPublicUrl(null)).toBeNull();
  });
});
