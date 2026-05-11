const upload = require("../multer");

describe("multer config", () => {
  it("exports configured multer instance", () => {
    expect(upload).toBeDefined();
    expect(typeof upload.single).toBe("function");
  });
});
