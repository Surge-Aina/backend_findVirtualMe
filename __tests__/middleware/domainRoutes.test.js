jest.mock('../../../middleware/auth', () =>
  jest.fn((req, _res, next) => {
    req.user = {
      id: 'user123',
      email: 'test@example.com',
    };
    next();
  })
);

jest.mock('../../../services/domainService.js', () => ({
  getDomain: jest.fn(),
  registerDomain: jest.fn(),
  configureCustomDomain: jest.fn(),
  getMyDomains: jest.fn(),
  verifyDNS: jest.fn(),
  lookupPortfolioByDomain: jest.fn(),
}));

const domainService = require('../../services/domainService.js');
const domainRoutes = require('../../routes/domainRoutes.js');

const findRoute = (path, method) =>
  domainRoutes.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()]
  );

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn().mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((payload) => {
    res.body = payload;
    return res;
  });
  return res;
};

const runRoute = async ({
  path,
  method,
  params = {},
  body = {},
  headers = {},
}) => {
  const routeLayer = findRoute(path, method);
  if (!routeLayer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  const middlewareStack = routeLayer.route.stack.map((layer) => layer.handle);
  const req = {
    params: { ...params },
    body: { ...body },
    headers: { ...headers },
    method: method.toUpperCase(),
    query: {},
    user: undefined,
  };
  const res = createMockRes();

  let index = 0;
  const next = async () => {
    const fn = middlewareStack[index++];
    if (!fn) {
      return;
    }
    await fn(req, res, next);
  };

  await next();

  return { req, res };
};

describe('domainRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/domains/check/:domain delegates to domainService.getDomain', async () => {
    domainService.getDomain.mockImplementation((req, res) =>
      res.status(200).json({
        domain: req.params.domain,
        available: true,
        isPremium: false,
      })
    );

    const { res, req } = await runRoute({
      path: '/check/:domain',
      method: 'get',
      params: { domain: 'testdomain.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      domain: 'testdomain.com',
      available: true,
      isPremium: false,
    });
    expect(domainService.getDomain).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(
      expect.objectContaining({ id: 'user123', email: 'test@example.com' })
    );
  });

  test('POST /api/domains/register calls domainService.registerDomain', async () => {
    domainService.registerDomain.mockImplementation((req, res) =>
      res.status(200).json({
        message: 'Domain registration initiated',
        domain: req.body.domain,
        portfolioId: req.body.portfolioId,
        status: 'active',
      })
    );

    const { res } = await runRoute({
      path: '/register',
      method: 'post',
      body: { domain: 'example.com', portfolioId: 'portfolio123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Domain registration initiated',
      domain: 'example.com',
      portfolioId: 'portfolio123',
      status: 'active',
    });
    expect(domainService.registerDomain).toHaveBeenCalledTimes(1);
  });

  test('POST /api/domains/custom calls domainService.configureCustomDomain', async () => {
    domainService.configureCustomDomain.mockImplementation((req, res) =>
      res.status(200).json({
        message: 'Custom domain configured',
        domain: req.body.domain,
        portfolioId: req.body.portfolioId,
        status: 'active',
      })
    );

    const { res } = await runRoute({
      path: '/custom',
      method: 'post',
      body: { domain: 'custom.com', portfolioId: 'portfolio456' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Custom domain configured',
      domain: 'custom.com',
      portfolioId: 'portfolio456',
      status: 'active',
    });
    expect(domainService.configureCustomDomain).toHaveBeenCalledTimes(1);
  });

  test('GET /api/domains/myDomains returns data from domainService.getMyDomains', async () => {
    domainService.getMyDomains.mockImplementation((req, res) =>
      res.status(200).json({
        user: { id: req.user.id, email: req.user.email },
        domains: [{ domain: 'example.com', status: 'active', type: 'platform' }],
        portfolios: ['portfolio123'],
      })
    );

    const { res } = await runRoute({
      path: '/myDomains',
      method: 'get',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      user: { id: 'user123', email: 'test@example.com' },
      domains: [{ domain: 'example.com', status: 'active', type: 'platform' }],
      portfolios: ['portfolio123'],
    });
    expect(domainService.getMyDomains).toHaveBeenCalledTimes(1);
  });

  test('POST /api/domains/verify/:domain calls domainService.verifyDNS', async () => {
    domainService.verifyDNS.mockImplementation((req, res) =>
      res.status(200).json({
        message: 'Domain verified and activated',
        domain: req.params.domain,
      })
    );

    const { res } = await runRoute({
      path: '/verify/:domain',
      method: 'post',
      params: { domain: 'example.com' },
      body: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Domain verified and activated',
      domain: 'example.com',
    });
    expect(domainService.verifyDNS).toHaveBeenCalledTimes(1);
  });

  test('GET /api/domains/lookup/:domain delegates to domainService.lookupPortfolioByDomain', async () => {
    domainService.lookupPortfolioByDomain.mockImplementation((req, res) =>
      res.status(200).json({
        success: true,
        domain: req.params.domain,
        portfolioId: 'portfolio789',
        portfolioPath: '/portfolios/project-manager/jane/portfolio789',
      })
    );

    const { res, req } = await runRoute({
      path: '/lookup/:domain',
      method: 'get',
      params: { domain: 'example.com' },
    });

    expect(req.user).toBeUndefined(); // public route
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      domain: 'example.com',
      portfolioId: 'portfolio789',
      portfolioPath: '/portfolios/project-manager/jane/portfolio789',
    });
    expect(domainService.lookupPortfolioByDomain).toHaveBeenCalledTimes(1);
  });

  test('GET /api/domains/check/:domain forwards error responses', async () => {
    domainService.getDomain.mockImplementation((req, res) =>
      res.status(400).json({ error: 'Invalid domain format' })
    );

    const { res } = await runRoute({
      path: '/check/:domain',
      method: 'get',
      params: { domain: 'bad..domain' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid domain format' });
  });
});
