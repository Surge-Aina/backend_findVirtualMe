jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

jest.mock("../../portfolios/models/Portfolio", () => ({
  find: jest.fn(),
}));

jest.mock("../../../shared/services/s3Service", () => ({
  listByPrefix: jest.fn(),
  deleteFromS3: jest.fn().mockResolvedValue(undefined),
  keyFromPublicUrl: jest.fn((url) => {
    if (!url || typeof url !== "string") return null;
    const m = url.match(/amazonaws\.com\/(.+)$/);
    return m ? m[1] : null;
  }),
}));

const Portfolio = require("../../portfolios/models/Portfolio");
const {
  listByPrefix,
  deleteFromS3,
  keyFromPublicUrl,
} = require("../../../shared/services/s3Service");
const { runOrphanImageGc } = require("../gcOrphanImages");

function asyncIterableFromDocs(docs) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const d of docs) {
        yield d;
      }
    },
  };
}

describe("gcOrphanImages", () => {
  const origBucket = process.env.AWS_S3_BUCKET;
  const origRegion = process.env.AWS_REGION;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_S3_BUCKET = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
  });

  afterEach(() => {
    process.env.AWS_S3_BUCKET = origBucket;
    process.env.AWS_REGION = origRegion;
  });

  it("runOrphanImageGc returns early when bucket missing", async () => {
    delete process.env.AWS_S3_BUCKET;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await runOrphanImageGc();

    expect(warn).toHaveBeenCalled();
    expect(listByPrefix).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("runOrphanImageGc deletes unreferenced old keys", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    listByPrefix.mockResolvedValue([
      { Key: "portfolios/orphan-key.jpg", LastModified: oldDate },
    ]);

    Portfolio.find.mockReturnValue({
      select: () => ({
        lean: () => ({
          cursor: () => asyncIterableFromDocs([]),
        }),
      }),
    });

    await runOrphanImageGc();

    expect(deleteFromS3).toHaveBeenCalledWith("portfolios/orphan-key.jpg");
  });

  it("runOrphanImageGc skips keys still referenced in portfolio docs", async () => {
    const url = `https://test-bucket.s3.us-east-1.amazonaws.com/portfolios/kept/key.jpg`;
    listByPrefix.mockResolvedValue([
      {
        Key: "portfolios/kept/key.jpg",
        LastModified: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    ]);

    Portfolio.find.mockReturnValue({
      select: () => ({
        lean: () => ({
          cursor: () =>
            asyncIterableFromDocs([
              {
                navBrand: url,
                sections: null,
                pageBannerDefaults: null,
              },
            ]),
        }),
      }),
    });

    keyFromPublicUrl.mockImplementation((u) => {
      if (u === url) return "portfolios/kept/key.jpg";
      const m = String(u).match(/amazonaws\.com\/(.+)$/);
      return m ? m[1] : null;
    });

    await runOrphanImageGc();

    expect(deleteFromS3).not.toHaveBeenCalled();
  });

  it("runOrphanImageGc skips objects in grace period", async () => {
    listByPrefix.mockResolvedValue([
      {
        Key: "portfolios/new.jpg",
        LastModified: new Date(),
      },
    ]);

    Portfolio.find.mockReturnValue({
      select: () => ({
        lean: () => ({
          cursor: () => asyncIterableFromDocs([]),
        }),
      }),
    });

    await runOrphanImageGc();

    expect(deleteFromS3).not.toHaveBeenCalled();
  });

});
