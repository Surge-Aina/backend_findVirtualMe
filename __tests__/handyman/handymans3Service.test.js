    // __tests__/handyman/handymans3Service.test.js

    // Mock uuid so Jest never loads the ESM version of the module
    jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid'),
    }));

    // ✅ Use "mock*" prefix so Jest allows referencing it in the factory.
    const mockSend = jest.fn();

    jest.mock('@aws-sdk/client-s3', () => {
    class S3Client {
        send(cmd) {
        return mockSend(cmd);
        }
    }
    class PutObjectCommand {
        constructor(input) {
        this.input = input;
        }
    }
    class DeleteObjectCommand {
        constructor(input) {
        this.input = input;
        }
    }
    return { __esModule: true, S3Client, PutObjectCommand, DeleteObjectCommand };
    });

    let s3Service;

    beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    // load after mocks are set
    s3Service = require('../../services/s3Service'); // keep your working relative path
    });

    // Helpers
    const resolvePut = () => mockSend.mockResolvedValue({ ETag: '"abc123"' });
    const rejectPut = (msg = 'put fail') =>
    mockSend.mockRejectedValue(new Error(msg));
    const resolveDel = () => mockSend.mockResolvedValue({ ok: true });
    const rejectDel = (msg = 'del fail') =>
    mockSend.mockRejectedValue(new Error(msg));

    describe('s3Service', () => {
    test('uploads successfully with prefix and returns URL + key', async () => {
        resolvePut();
        const buf = Buffer.from('file-bytes');
        const out = await s3Service.uploadToS3(
        buf,
        'photo.jpg',
        'image/jpeg',
        '///Ports/HandyMan//'
        );

        expect(out).toHaveProperty('url');
        expect(out).toHaveProperty('key');

        // prefix should be normalized & extension should be preserved
        expect(out.key.startsWith('Ports/HandyMan/')).toBe(true);
        expect(out.key.endsWith('.jpg')).toBe(true);
    });

    test('trims leading/trailing slashes in prefix', async () => {
        resolvePut();
        const out = await s3Service.uploadToS3(
        Buffer.from('x'),
        'a.png',
        'image/png',
        '/a/b//'
        );

        // The implementation uses a UUID, not the original filename.
        // We just care that the prefix is normalized and extension is .png.
        expect(out.key.startsWith('a/b/')).toBe(true);
        expect(out.key.endsWith('.png')).toBe(true);
    });

    test('handles no prefix (key is just filename-like)', async () => {
        resolvePut();
        const out = await s3Service.uploadToS3(
        Buffer.from('x'),
        'a.png',
        'image/png'
        );

        // Implementation uses UUID, so key is something like "test-uuid.png"
        expect(out.key.endsWith('.png')).toBe(true);
        // No directory separator when no prefix was provided
        expect(out.key.includes('/')).toBe(false);
    });

    test('uses "bin" extension if fileName is undefined', async () => {
        resolvePut();
        const out = await s3Service.uploadToS3(
        Buffer.from('x'),
        undefined,
        'application/octet-stream',
        'binz'
        );
        expect(out.key.startsWith('binz/')).toBe(true);
        expect(out.key.endsWith('.bin')).toBe(true);
    });

    test('propagates errors from AWS on upload', async () => {
        rejectPut('AWS down');
        await expect(
        s3Service.uploadToS3(Buffer.from('x'), 'a.png', 'image/png', 'p')
        ).rejects.toThrow(/AWS down/i);
    });

    test('deleteFromS3 deletes successfully', async () => {
        resolveDel();
        // Your real implementation doesn’t return { ok: true }, it just resolves.
        await expect(
        s3Service.deleteFromS3('Ports/HandyMan/a.png')
        ).resolves.toBeUndefined();
    });

    test('propagates errors from AWS on delete', async () => {
        rejectDel('delete failed');
        await expect(
        s3Service.deleteFromS3('Ports/HandyMan/a.png')
        ).rejects.toThrow(/delete failed/i);
    });
    });
