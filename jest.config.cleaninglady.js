
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'controllers/**/*.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/__tests__/**/*.test.js',  // ← Add this line
    '**/?(*.)+(spec|test).js'      // ← Add this line
  ]
};