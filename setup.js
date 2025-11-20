// Test setup file for Jest
process.env.NODE_ENV = "test";

//set default open api key for tests
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-key";
}

// Set default database URI for tests
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb://localhost:27017/findVirtualMe";
}

// Set test database URI
if (!process.env.MONGODB_URI_TEST) {
  process.env.MONGODB_URI_TEST = "mongodb://localhost:27017/test-portfolio";
}

// Set JWT secret for tests
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET =
    "eadf50f302ece478535332bd3f0cee4a6fa76e247f884833e38912d96a421096";
}

// Set default port
if (!process.env.PORT) {
  process.env.PORT = "5100";
}

// Ensure no port conflicts with main application
process.env.PORT = undefined;

//mongodb setup
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

// Clean up database and mocks between tests
afterEach(async () => {
  jest.clearAllMocks();

  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Mock file system operations to prevent conflicts
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// // Mock multer to prevent file upload conflicts
// jest.mock("multer", () => {
//   const multer = jest.fn().mockReturnValue({
//     single: jest.fn().mockImplementation((fieldName) => {
//       return (req, res, next) => {
//         // Check if this is a test for no file provided
//         if (req.headers["x-test-no-file"] === "true") {
//           req.file = null;
//           return next();
//         }

//         // Case: vendor inject (PDF upload)
//         if (fieldName === "file") {
//           req.file = {
//             fieldname: "file",
//             originalname: "test.pdf",
//             encoding: "7bit",
//             mimetype: "application/pdf",
//             buffer: Buffer.from("%PDF-1.3 fake"), // something pdf-parse can handle
//             size: 1024,
//             filename: Date.now() + ".pdf",
//           };
//         }

//         // Create different mock files based on field name
//         if (fieldName === "avatar") {
//           req.file = {
//             fieldname: "avatar",
//             originalname: "test-avatar.jpg",
//             encoding: "7bit",
//             mimetype: "image/jpeg",
//             buffer: Buffer.from("fake-image-data"),
//             size: 1024,
//             filename: Date.now() + ".jpg",
//           };
//         } else if (fieldName === "certificateImage") {
//           // Check the filename to determine file type
//           const filename = req.body?.filename || "test-cert.pdf";
//           let mimetype = "application/pdf";
//           let ext = ".pdf";

//           if (filename.includes(".pptx")) {
//             mimetype =
//               "application/vnd.openxmlformats-officedocument.presentationml.presentation";
//             ext = ".pptx";
//           } else if (filename.includes(".ppt")) {
//             mimetype = "application/vnd.ms-powerpoint";
//             ext = ".ppt";
//           }

//           req.file = {
//             fieldname: "certificateImage",
//             originalname: filename,
//             encoding: "7bit",
//             mimetype: mimetype,
//             buffer: Buffer.from("fake-cert-data"),
//             size: 2048,
//             filename: Date.now() + ext,
//           };
//         }
//         else if (fieldName === "projectImage") {
//           req.file = {
//             fieldname: "projectImage",
//             originalname: "test-project.jpg",
//             encoding: "7bit",
//             mimetype: "image/jpeg",
//             buffer: Buffer.from("fake-project-image"),
//             size: 1024,
//             filename: Date.now() + ".jpg",
//           };
//         } else {
//           // For invalid file types, simulate file filter rejection
//           const error = new Error(
//             "Only image files, PDFs, and PowerPoint files are allowed!"
//           );
//           error.code = "LIMIT_FILE_TYPE";
//           return next(error);
//         }
//         next();
//       };
//     }),

//     fields: jest.fn().mockImplementation((fieldsArray) => {
//       return (req, res, next) => {
//         req.files = {};
//         fieldsArray.forEach(({ name, maxCount }) => {
//           req.files[name] = Array.from({ length: maxCount || 1 }).map(
//             (_, i) => ({
//               fieldname: name,
//               originalname: `test-${name}-${i + 1}.jpg`,
//               encoding: "7bit",
//               mimetype: "image/jpeg",
//               buffer: Buffer.from("fake-image-data"),
//               size: 1024,
//               filename: `${Date.now()}-${i + 1}.jpg`,
//             })
//           );
//         });
//         next();
//       };
//     }),

//     // ✅ Mock for upload.array(fieldName, maxCount)
//     array: jest.fn().mockImplementation((fieldName, maxCount) => {
//       return (req, res, next) => {
//         req.files = Array.from({ length: maxCount || 1 }).map((_, i) => ({
//           fieldname: fieldName,
//           originalname: `test-${fieldName}-${i + 1}.jpg`,
//           encoding: "7bit",
//           mimetype: "image/jpeg",
//           buffer: Buffer.from("fake-image-data"),
//           size: 1024,
//           filename: `${Date.now()}-${i + 1}.jpg`,
//         }));
//         next();
//       };
//     }),
//   });

//   // Mock the diskStorage method
//   multer.diskStorage = jest.fn().mockReturnValue({
//     destination: jest.fn(),
//     filename: jest.fn(),
//   });

//   return multer;
// });

// Global test cleanup
afterEach(() => {
  jest.clearAllMocks();
});