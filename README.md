# Test Suite for Software Engineering Portfolio API

This directory contains comprehensive test cases for the Software Engineering Portfolio functionality.

## Test Structure

```
tests/
├── softwareEng.test.js         # API integration tests
└── softwareeng.model.test.js   # Model unit tests

Configuration Files:
├── setup.js                    # Jest setup and configuration
├── jest.config.js              # Jest configuration
└── test-README.md              # This documentation file
```

## Test Categories

### 1. API Integration Tests (`softwareEng.test.js`)
Tests the complete API endpoints including:
- **GET** `/software-eng/:ownerId` - Portfolio retrieval
- **PUT** `/software-eng/:ownerId` - Portfolio updates
- **POST** `/software-eng/:ownerId/photo` - Profile photo upload
- **POST** `/software-eng/:ownerId/certificate-image` - Certificate upload
- **POST** `/software-eng/:ownerId/project-image` - Project image upload
- **DELETE** `/software-eng/:ownerId` - Portfolio deletion
- **WebSocket Integration** - Real-time update testing
- **Error Handling** - Invalid requests and edge cases

### 2. Model Unit Tests (`softwareeng.model.test.js`)
Tests the SoftwareEng model including:
- **Schema Validation** - Data structure validation
- **Model Methods** - CRUD operations
- **Data Types** - Field type handling
- **Edge Cases** - Long text, special characters, unicode

## Prerequisites

Before running tests, ensure you have:

1. **MongoDB** running locally on the default port (27017)
2. **Node.js** and **npm** installed
3. **Dependencies** installed (`npm install`)

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Individual Test Files
```bash
# Run only API tests
npm test -- tests/softwareEng.test.js

# Run only model tests
npm test -- tests/softwareeng.model.test.js
```

## Test Environment

- **Database**: Uses separate test database (`test-portfolio`)
- **File Uploads**: Mocked to prevent file system conflicts
- **WebSocket**: Tested via event emission verification
- **Console Output**: Mocked to reduce test noise

## Environment Variables

The tests will work with default values, but you can create a `.env` file for custom configuration:

```bash
# Copy the example file
cp .env.example .env

# Or create manually with these variables:
NODE_ENV=development
PORT=5100
MONGODB_URI=mongodb://localhost:27017/findVirtualMe
JWT_SECRET=your_jwt_secret_key_here
MONGODB_URI_TEST=mongodb://localhost:27017/test-portfolio
```

**Note**: If no `.env` file exists, the tests will use default values automatically.

## Test Data

The tests use predefined test data including:
- Sample portfolios with complete profiles
- Test skills, projects, experience, education, and certifications
- Mock file uploads for images, PDFs, and PowerPoint files

## Coverage

Tests cover:
- ✅ **Happy Path** - Successful operations
- ✅ **Error Cases** - Invalid requests and edge cases
- ✅ **Data Validation** - Schema and type validation
- ✅ **File Uploads** - Image and document uploads
- ✅ **Real-time Updates** - WebSocket event emission
- ✅ **Database Operations** - CRUD operations
- ✅ **API Responses** - Status codes and response formats

## Mocking Strategy

- **File System**: Mocked to prevent actual file creation
- **Multer**: Mocked to simulate file uploads
- **Console**: Mocked to reduce test output noise
- **Database**: Uses isolated test database

## Best Practices

1. **Isolation**: Each test runs in isolation with clean data
2. **Cleanup**: Database is cleaned before and after tests
3. **Mocking**: External dependencies are properly mocked
4. **Coverage**: Aim for high test coverage of critical paths
5. **Readability**: Tests are descriptive and well-organized

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure MongoDB is running locally
2. **Port Conflicts**: Tests use different ports to avoid conflicts
3. **File Permissions**: Ensure uploads directory is writable
4. **Environment Variables**: Test environment is properly configured

### Debug Mode

To run tests in debug mode:
```bash
NODE_ENV=test DEBUG=* npm test
```

## Adding New Tests

When adding new functionality:

1. **API Tests**: Add to `softwareEng.test.js`
2. **Model Tests**: Add to `softwareeng.model.test.js`
3. **Setup**: Update `setup.js` if new mocks are needed
4. **Documentation**: Update this README with new test categories
