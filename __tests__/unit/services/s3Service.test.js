    // __tests__/unit/services/s3Service.test.js

    // 👇 Use a mock*-prefixed var so Jest allows it inside the factory.
    let mockSend;

    jest.mock("@aws-sdk/client-s3", () => {
    mockSend = jest.fn();
    return {
        S3Client: jest.fn(() => ({ send: mockSend })),
        PutObjectCommand: jest.fn().mockImplementation((args) => args),
        DeleteObjectCommand: jest.fn().mockImplementation((args) => args),
    };
    });

    jest.mock("uuid", () => ({
    v4: jest.fn(() => "mock-uuid"),
    }));

    const { uploadToS3, deleteFromS3 } = require("../../../services/s3Service");
    const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

    describe("S3Service", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
        ...originalEnv,
        AWS_S3_BUCKET: "findvirtualme",
        AWS_REGION: "us-west-1",
        AWS_ACCESS_KEY_ID: "dummy",
        AWS_SECRET_ACCESS_KEY: "dummy",
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe("uploadToS3", () => {
        it("uploads successfully with prefix and returns URL + key", async () => {
        mockSend.mockResolvedValueOnce({});

        const buffer = Buffer.from("fake-bytes");
        const res = await uploadToS3(buffer, "photo.JPG", "image/jpeg", "ports/HandyMan");

        expect(PutObjectCommand).toHaveBeenCalledTimes(1);
        expect(PutObjectCommand).toHaveBeenCalledWith({
            Bucket: "findvirtualme",
            Key: "ports/HandyMan/mock-uuid.jpg",
            Body: buffer,
            ContentType: "image/jpeg",
        });
        expect(mockSend).toHaveBeenCalledTimes(1);

        expect(res).toEqual({
            url: "https://findvirtualme.s3.us-west-1.amazonaws.com/ports/HandyMan/mock-uuid.jpg",
            key: "ports/HandyMan/mock-uuid.jpg",
        });
        });

        it("trims leading/trailing slashes in prefix", async () => {
        mockSend.mockResolvedValueOnce({});
        const res = await uploadToS3(Buffer.from("x"), "img.png", "image/png", "/ports/HandyMan/");
        expect(PutObjectCommand).toHaveBeenCalledWith(
            expect.objectContaining({ Key: "ports/HandyMan/mock-uuid.png" })
        );
        expect(res.key).toBe("ports/HandyMan/mock-uuid.png");
        });

        it("handles no prefix (key is just filename)", async () => {
        mockSend.mockResolvedValueOnce({});
        const res = await uploadToS3(Buffer.from("x"), "pic.jpeg", "image/jpeg");
        expect(PutObjectCommand).toHaveBeenCalledWith(
            expect.objectContaining({ Key: "mock-uuid.jpeg" })
        );
        expect(res.key).toBe("mock-uuid.jpeg");
        expect(res.url).toBe("https://findvirtualme.s3.us-west-1.amazonaws.com/mock-uuid.jpeg");
        });

        it("uses 'bin' extension if fileName is undefined", async () => {
        mockSend.mockResolvedValueOnce({});
        const res = await uploadToS3(
            Buffer.from("x"),
            undefined,
            "application/octet-stream",
            "files"
        );
        expect(PutObjectCommand).toHaveBeenCalledWith(
            expect.objectContaining({
            Key: "files/mock-uuid.bin",
            ContentType: "application/octet-stream",
            })
        );
        expect(res.key).toBe("files/mock-uuid.bin");
        });

        it("propagates errors from AWS on upload", async () => {
        mockSend.mockRejectedValueOnce(new Error("S3 failed"));
        await expect(
            uploadToS3(Buffer.from("x"), "file.txt", "text/plain", "docs")
        ).rejects.toThrow("S3 failed");
        expect(PutObjectCommand).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledTimes(1);
        });
    });

    describe("deleteFromS3", () => {
        it("deletes successfully", async () => {
        mockSend.mockResolvedValueOnce({});
        await deleteFromS3("ports/HandyMan/mock-uuid.jpg");
        expect(DeleteObjectCommand).toHaveBeenCalledTimes(1);
        expect(DeleteObjectCommand).toHaveBeenCalledWith({
            Bucket: "findvirtualme",
            Key: "ports/HandyMan/mock-uuid.jpg",
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        });

        it("propagates errors from AWS on delete", async () => {
        mockSend.mockRejectedValueOnce(new Error("Delete error"));
        await expect(deleteFromS3("bad/key")).rejects.toThrow("Delete error");
        expect(DeleteObjectCommand).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledTimes(1);
        });
    });
    });
