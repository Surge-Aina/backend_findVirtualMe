const mockPassThrough = (req, res, next) => next();

jest.mock('socket.io', () => {
  const mockOn = jest.fn();
  const socketIo = jest.fn(() => ({ on: mockOn }));
  socketIo.__mockOn = mockOn;
  return socketIo;
});

jest.mock('cors', () => {
  const cors = jest.fn((options) => {
    cors.lastOptions = options;
    return function corsMiddleware(req, res, next) {
      return next();
    };
  });
  return cors;
});

jest.mock('../../utils/db', () => jest.fn(() => Promise.resolve()));
jest.mock('../../seed/users', () => jest.fn(() => Promise.resolve()));

jest.mock('../../oauthHandler', () => {
  const getTokensFromCode = jest.fn();
  return {
    oauth2Client: {},
    getAuthUrl: jest.fn(() => 'mock-url'),
    getTokensFromCode,
    setCredentialsFromEnv: jest.fn(),
    listFilesInFolder: jest.fn(),
    __mockGetTokensFromCode: getTokensFromCode,
  };
});

jest.mock('../../middleware/domainResolver', () => mockPassThrough);
jest.mock('../../middleware/auth', () => mockPassThrough);
jest.mock('../../middleware/roleCheck', () => () => mockPassThrough);

jest.mock('../../routes/photographer/settingsRoute', () => mockPassThrough);
jest.mock('../../routes/photographer/driveRoute', () => mockPassThrough);
jest.mock('../../routes/photographer/photoRoute', () => mockPassThrough);
jest.mock('../../routes/photographer/uploadRoute', () => mockPassThrough);
jest.mock('../../routes/userRoute', () => mockPassThrough);
jest.mock('../../routes/projectManager/portfolioRoute', () => mockPassThrough);
jest.mock('../../routes/softwareEngineer/portfolio', () => mockPassThrough);
jest.mock('../../routes/dataScientist/testimonialRoute', () => mockPassThrough);
jest.mock('../../routes/dataScientist/dashboardRoute', () => mockPassThrough);
jest.mock('../../routes/localFoodVendor/bannerRoutes', () => mockPassThrough);
jest.mock('../../routes/localFoodVendor/aboutRoutes', () => mockPassThrough);
jest.mock('../../routes/localFoodVendor/menuRoutes', () => mockPassThrough);
jest.mock('../../routes/localFoodVendor/galleryRoutes', () => mockPassThrough);
jest.mock('../../routes/localFoodVendor/reviewRoutes', () => mockPassThrough);
jest.mock('../../routes/localFoodVendor/taggedImageRoutes', () => mockPassThrough);
jest.mock('../../routes/handyMan/handymanPortfolioRoutes', () => mockPassThrough);
jest.mock('../../routes/dataScientist/dataScientistRoutes', () => mockPassThrough);
jest.mock('../../routes/userRoute2.js', () => mockPassThrough);
jest.mock('../../routes/serviceRoutes.js', () => mockPassThrough);
jest.mock('../../routes/quoteRoutes.js', () => mockPassThrough);
jest.mock('../../routes/roomRoutes.js', () => mockPassThrough);
jest.mock('../../routes/stripePayment/checkoutRoutes', () => mockPassThrough);
jest.mock('../../routes/auth', () => mockPassThrough);
jest.mock('../../routes/handyMan/handymanTemplateRoutes', () => mockPassThrough);
jest.mock('../../routes/handyMan/handymanInquiryRoutes', () => mockPassThrough);
jest.mock('../../routes/localFoodVendor/localVendorRoutes', () => mockPassThrough);
jest.mock('../../routes/subscriptionRoutes', () => mockPassThrough);
jest.mock('../../routes/stripeWebhookRoutes', () => mockPassThrough);
jest.mock('../../routes/supportFormRoutes', () => mockPassThrough);
jest.mock('../../routes/domainRoutes', () => mockPassThrough);
jest.mock('../../routes/telemetry', () => mockPassThrough);

jest.mock('../../models/User', () => {
  const exists = jest.fn().mockResolvedValue(false);
  return { exists, __mockExists: exists };
});

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  const appendFileSync = jest.fn();
  return {
    ...actual,
    appendFileSync,
    __mockAppendFileSync: appendFileSync,
  };
});

process.env.PORT = process.env.PORT || '5100';
process.env.FRONTEND_URL = 'https://app.example.com';
process.env.ADMIN_FRONTEND_URL = 'https://admin.example.com';
process.env.PUBLIC_APP_URL = 'https://public.example.com';
process.env.CORS_ADDITIONAL_ORIGINS = '';

const express = require('express');
const getDefinitions = [];
const useHandlers = [];
const originalGet = express.application.get;
const originalUse = express.application.use;

express.application.get = function patchedGet(path, ...handlers) {
  getDefinitions.push({ path, handlers });
  return originalGet.call(this, path, ...handlers);
};

express.application.use = function patchedUse(pathOrFn, ...handlers) {
  if (typeof pathOrFn === 'function') {
    useHandlers.push(pathOrFn);
  } else {
    useHandlers.push(...handlers);
  }
  return originalUse.call(this, pathOrFn, ...handlers);
};

const http = require('http');
const createServerSpy = jest.spyOn(http, 'createServer');

const fs = require('fs');
const appendFileSyncMock = fs.__mockAppendFileSync;

const oauthHandler = require('../../oauthHandler');
const mockGetTokensFromCode = oauthHandler.__mockGetTokensFromCode;

const User = require('../../models/User');
const mockUserExists = User.__mockExists;

const cors = require('cors');

const { app } = require('../../index');

express.application.get = originalGet;
express.application.use = originalUse;

const oauthCallbackRoute = getDefinitions.find(
  (def) => def.path === '/oauth2callback'
);

if (!oauthCallbackRoute) {
  throw new Error('OAuth callback route not registered');
}

const oauthCallbackHandler =
  oauthCallbackRoute.handlers[oauthCallbackRoute.handlers.length - 1];

let corsOptions;

beforeAll(() => {
  corsOptions = cors.lastOptions;
});

afterAll(() => {
  createServerSpy.mockRestore();
});

beforeEach(() => {
  mockGetTokensFromCode.mockReset();
  appendFileSyncMock.mockClear();
});

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('index.js OAuth callback route', () => {
  it('responds with success and does not spin up a new server instance', async () => {
    const initialCreateServerCalls = createServerSpy.mock.calls.length;
    mockGetTokensFromCode.mockResolvedValue({ refresh_token: 'token-123' });

    const res = createResponse();
    await oauthCallbackHandler({ query: { code: 'abc' } }, res);

    expect(createServerSpy.mock.calls.length).toBe(initialCreateServerCalls);
    expect(mockGetTokensFromCode).toHaveBeenCalledWith('abc');
    expect(res.send).toHaveBeenCalledWith(
      'Authorization successful! You can close this tab.'
    );
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(appendFileSyncMock).toHaveBeenCalledWith(
      '.env',
      '\nREFRESH_TOKEN=token-123'
    );
  });

  it('handles OAuth errors without duplicating server setup', async () => {
    const initialCreateServerCalls = createServerSpy.mock.calls.length;
    mockGetTokensFromCode.mockRejectedValue(new Error('boom'));

    const res = createResponse();
    await oauthCallbackHandler({ query: { code: 'bad' } }, res);

    expect(createServerSpy.mock.calls.length).toBe(initialCreateServerCalls);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Auth failed');
    expect(appendFileSyncMock).not.toHaveBeenCalled();
  });
});

describe('index.js CORS configuration', () => {
  it('registers a single CORS middleware', () => {
    const middlewareNames = useHandlers.map((fn) => fn && fn.name);
    expect(middlewareNames).toContain('corsMiddleware');
    const corsMiddlewareCount = middlewareNames.filter(
      (name) => name === 'corsMiddleware'
    ).length;

    expect(corsMiddlewareCount).toBe(1);
    expect(typeof corsOptions.origin).toBe('function');
  });

  it('allows surge vercel preview hosts without hitting the database', () => {
    const callback = jest.fn();

    corsOptions.origin(
      'https://preview.surge-ainas-projects.vercel.app',
      callback
    );

    expect(callback).toHaveBeenCalledWith(null, true);
    expect(mockUserExists).not.toHaveBeenCalled();
  });

  it('allows dynamically registered customer domains', async () => {
    mockUserExists.mockResolvedValueOnce(true);
    const callback = jest.fn((err, allowed) => {
      expect(err).toBeNull();
      expect(allowed).toBe(true);
    });

    corsOptions.origin('https://client.example.net', callback);

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockUserExists).toHaveBeenCalledWith({
      'domains.domain': 'client.example.net',
      'domains.status': 'active',
    });
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('blocks unknown origins when no domain match is found', async () => {
    mockUserExists.mockResolvedValueOnce(false);
    const callback = jest.fn((err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Not allowed by CORS');
    });

    corsOptions.origin('https://unknown.example.net', callback);

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockUserExists).toHaveBeenCalledWith({
      'domains.domain': 'unknown.example.net',
      'domains.status': 'active',
    });
    expect(callback).toHaveBeenCalled();
  });
});
