jest.mock("mongoose", () => ({
  set: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
}));

const mongoose = require("mongoose");
const connectDB = require("../db");

describe("db connectDB", () => {
  it("connects and logs on success", async () => {
    process.env.MONGODB_URI = "mongodb://localhost/test";
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith("mongodb://localhost/test");
    expect(log).toHaveBeenCalledWith("MongoDB connected");
    log.mockRestore();
  });

  it("throws on failure", async () => {
    mongoose.connect.mockRejectedValueOnce(new Error("fail"));
    const errLog = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(connectDB()).rejects.toThrow("fail");
    expect(errLog).toHaveBeenCalled();
    errLog.mockRestore();
  });

  it("fails clearly when MONGODB_URI is missing", async () => {
    const previous = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    const errLog = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(connectDB()).rejects.toThrow(
        "Missing required environment variable: MONGODB_URI"
      );
      expect(mongoose.connect).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) {
        delete process.env.MONGODB_URI;
      } else {
        process.env.MONGODB_URI = previous;
      }
      errLog.mockRestore();
    }
  });
});
