module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/setup.js"],
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/**/__tests__/**/*.test.js",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/modules/social-links/__tests__/",
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!(@vercel/sdk|uuid)/)",
  ],
  collectCoverageFrom: [
    "src/**/*.js",
    "routes/**/*.js",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/__tests__/**",
    "!**/test/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testTimeout: 30000,
  maxWorkers: 1,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: false,
  resetModules: true,
  restoreMocks: true,
};
