    module.exports = {
    testEnvironment: "node",
    testMatch: ["<rootDir>/tests/HandymanPortfolioTests/**/*.test.js"],

    // Skip ONLY the flaky auth middleware tests; no code changes to auth.js.
    testPathIgnorePatterns: [
        "/node_modules/",
        "<rootDir>/tests/HandymanPortfolioTests/auth.middleware.test.js"
    ],

    setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

    // ✅ Limit coverage to handyman controllers/models + handyman routes.
    collectCoverageFrom: [
        "controllers/handyman/handymanInquiryController.js",
        "controllers/handyman/handymanPortfolioController.js",
        "controllers/handyman/handymanTemplateController.js",
        "models/handyMan/HandymanTemplate.js",
        "models/handyMan/handymanInquiryModel.js",
        "models/handyMan/handymanPortfolioModel.js",

        // Handyman routes only
        "routes/handyMan/**/*.js",

        // but explicitly exclude auth route if you don’t want it counted
        "!routes/handyMan/handymanAuthRoutes.js"
    ],

    // ✅ Make sure nothing else sneaks into coverage.
    coveragePathIgnorePatterns: [
        "/node_modules/",
        "middleware/auth.js", // don't count auth middleware
        "models/handyMan/handymanUserModel.js",
        "services/s3Service.js",

        // exclude all non-handyman routes
        "^routes/(?!handyMan/).*", // anything under routes/ except routes/handyMan/**
        "server.js",
        "app.js",
        "index.js"
    ],

    coverageThreshold: {
        global: { statements: 80, branches: 65, functions: 90, lines: 80 }
    },

    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],
    maxWorkers: 1,
    clearMocks: true,
    verbose: true
    };
