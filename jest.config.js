module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/setup.js"],
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/__tests__/**/*.test.js",
  ],
  collectCoverageFrom: [
    "routes/**/*.js",
    "models/**/*.js",
    "controllers/**/*.js",
    "!**/node_modules/**",
    "!**/coverage/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
};
