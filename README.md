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

Deployed environments must set `MONGODB_URI` and `JWT_SECRET`. Do not commit those values.

Optional one-click admin handoff (disabled unless explicitly enabled):

- `SITE_DRAFTS_ENABLED` — set to `true` to route owner portfolio edits through drafts and versioned publish. When unset or any other value, portfolio APIs behave as before (every save updates the live site).

- `FEATURE_COMPONENTS_ENABLED` — set to `true` to expose reusable site section components (contact/lead form, gallery, services, testimonials, business hours) on unified templates. Owner route: `GET /api/portfolios/components?siteId=`. Public API and MCP write tools require `SITE_DRAFTS_ENABLED`, the `sites:write` scope (not granted on existing keys by default), and write only to the working draft with `approvalState: pending_owner`. OAuth/MCP writes set draft `source` to `ai`; API-key writes set `api`. When unset or any other value, behavior matches the pre-components API (component routes return `FEATURE_COMPONENTS_DISABLED`).

**Portfolio draft / publish (requires `SITE_DRAFTS_ENABLED=true`)**

Owner-authenticated routes under `/api/portfolios/:id`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/draft` | Published document plus working draft metadata (`hasDraft`, `draft`, `published`). |
| `POST` | `/publish` | Applies the working draft to the live site and stores an immutable snapshot (max 20 per site). |
| `GET` | `/versions` | Lists version numbers with `publishedAt` and `source`. |
| `GET` | `/versions/:versionNumber` | Returns the frozen snapshot for preview. |
| `POST` | `/versions/:versionNumber/revert` | Loads a version into the working draft only; call `POST /publish` to go live. |

With drafts enabled, existing `PATCH /:id`, section CRUD, reorder, visibility, and branding routes write to the draft (response includes `draftMode: true`). Public `GET /:id` and `GET /slug/:slug` continue to serve the last published document until publish.

Draft documents record `source` (`owner` \| `ai` \| `api`) and `approvalState` (`pending_owner` \| `approved` \| `rejected`). With `FEATURE_COMPONENTS_ENABLED` and `SITE_DRAFTS_ENABLED`, Public API / MCP `sites:write` tools land AI/API-sourced component edits on the draft only until the owner publishes.

**Feature components (requires `FEATURE_COMPONENTS_ENABLED=true`)**

Component registry follows the [Puck](https://github.com/puckeditor/puck) (MIT) `ComponentConfig` shape: each type has `fields`, `defaultProps`, and a stable `type` name. `GET /api/portfolios/components?siteId=` returns Puck `config` plus current site `data` (`{ content, root, zones }`) and `dataMapping` (how Puck maps to portfolio `sections`). Puck component types: `ContactLeadForm`, `Gallery`, `Services`, `Testimonials`, `BusinessHours` (each `metadata.blockType` is the persisted `section.type`). Legacy alias ids (`contactLeadForm`, etc.) are accepted on writes only. Contact/lead submissions from the public site continue to use `POST /api/contact` (same validation, lifecycle events, and webhooks as today). The backend does not vendor Puck; clients add `render()` locally.

| Surface | Method | Path / tool | Scope |
|---------|--------|-------------|-------|
| Owner | GET | `/api/portfolios/components?siteId=` | session JWT |
| Public API | GET | `/api/public/v1/sites/:id/components` | `sites:read` |
| Public API | POST | `/api/public/v1/sites/:id/components` | `sites:write` |
| Public API | PATCH | `/api/public/v1/sites/:id/components/:sectionId` | `sites:write` |
| Public API | DELETE | `/api/public/v1/sites/:id/components/:sectionId` | `sites:write` |
| Public API | POST | `/api/public/v1/sites/:id/components/reorder` | `sites:write` |
| MCP | — | `list_components`, `add_component`, `update_component`, `remove_component`, `reorder_components` | read / `sites:write` |

- `BAGGLEME_HANDOFF_ENABLED` — set to `true` to expose `POST /api/auth/baggleme`; omit or any other value keeps the route hidden (404).
- `BAGGLEME_HANDOFF_PUBLIC_KEY` — Ed25519 public key (SPKI PEM) used to verify handoff JWTs from the issuer. Multi-line PEM values may use literal `\n` in the env string.
- `BAGGLEME_HANDOFF_USER_ID` — MongoDB `_id` of a pinned user allowed to sign in via handoff (legacy single-user config; merged into the allowlist below).
- `BAGGLEME_HANDOFF_USER_IDS` — Comma-separated MongoDB `_id` values allowed as JWT `sub` for handoff login. Merged with `BAGGLEME_HANDOFF_USER_ID`.
- `DEMO_EMAIL` / `DEMO_PASSWORD` — Credentials for `scripts/create-demo-account.js` (demo customer seeding).

Optional phone OTP sign-in via Twilio Verify (disabled unless explicitly enabled):

- `PHONE_LOGIN_ENABLED` — set to `true` to expose `/api/auth/phone/*` routes; any other value keeps them hidden (404).
- `PHONE_ENC_KEY` — 32-byte AES key, base64-encoded, for encrypting E.164 phone numbers at rest.
- `PHONE_HASH_KEY` — 32-byte HMAC key, base64-encoded, for phone lookup hashes. If either key is missing, phone login stays off even when `PHONE_LOGIN_ENABLED` is `true`.
- `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_VERIFY_SERVICE_SID` — Twilio Verify credentials (API key auth).
- `OTP_DAILY_CAP` — global daily cap for OTP sends across the app (default `200`).

User seeding reads `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CUSTOMER_EMAIL`, `CUSTOMER_USERNAME`, and `CUSTOMER_PASSWORD`. The seed fails if any of them are missing.

The Jest setup forces `NODE_ENV=test` and, only in that mode, fills a synthetic `JWT_SECRET` when one is not already set. That value is not a production secret.

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
