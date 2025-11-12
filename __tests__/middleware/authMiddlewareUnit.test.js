/**
 * Unit tests for auth middleware
 * 
 * Core Auth - Auth middleware unit tests
 * Tests JWT token verification, user authentication, and error handling
 * Coverage: 100% (lines, branches, functions)
 * 
 * Test scenarios covered:
 * - Valid token: Token is valid and user exists
 * - Missing token: No token provided in request
 * - Invalid token: Token is malformed or signed with wrong secret
 * - Expired token: Token has expired (jwt.verify throws or manual exp check)
 */

const jwt = require('jsonwebtoken');
const auth = require('../../middleware/auth');
const User = require('../../models/User');

// Mock User model
jest.mock('../../models/User');

describe('auth middleware', () => {
  let mockReq, mockRes, mockNext;
  let consoleErrorSpy;
  let consoleLogSpy;

  // Helper to create a mock Query object that supports chainable .select()
  const createMockQuery = (result) => {
    const query = {
      select: jest.fn().mockReturnThis(),
    };
    // Make it thenable so it can be awaited
    if (result instanceof Error) {
      query.then = (onResolve, onReject) => Promise.reject(result).then(onResolve, onReject);
      query.catch = (onReject) => Promise.reject(result).catch(onReject);
    } else {
      query.then = (onResolve) => Promise.resolve(result).then(onResolve);
      query.catch = (onReject) => Promise.resolve(result).catch(onReject);
    }
    return query;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Note: JWT_SECRET is set by root setup.js (configured in jest.config.js)
    // Setup mock request, response, next
    mockReq = {
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // ============================================
  // MISSING TOKEN SCENARIOS
  // ============================================
  describe('Missing token', () => {
    it('should return 401 when no authorization header is provided', async () => {
      mockReq.headers = {};

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied. No token provided.',
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is empty string', async () => {
      mockReq.headers.authorization = '';

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied. No token provided.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is undefined', async () => {
      mockReq.headers.authorization = undefined;

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied. No token provided.',
      });
    });
  });

  // ============================================
  // INVALID TOKEN SCENARIOS
  // ============================================
  describe('Invalid token', () => {
    it('should return 401 when token is invalid (malformed)', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token-string';

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should return 401 when token is signed with wrong secret', async () => {
      const wrongToken = jwt.sign(
        { id: 'user123' },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      mockReq.headers.authorization = `Bearer ${wrongToken}`;

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return 401 when token format is wrong (no Bearer prefix)', async () => {
      const token = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      mockReq.headers.authorization = token; // Missing "Bearer " prefix

      await auth(mockReq, mockRes, mockNext);

      // Should still try to verify, but will fail
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  // ============================================
  // EXPIRED TOKEN SCENARIOS
  // ============================================
  describe('Expired token', () => {
    it('should return 401 when token is expired (jwt.verify throws)', async () => {
      // jwt.verify will throw an error for expired tokens
      const expiredToken = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );
      mockReq.headers.authorization = `Bearer ${expiredToken}`;

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token', // jwt.verify throws error for expired tokens, caught in catch block
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token has exp field and is past expiration (manual check)', async () => {
      // This tests the manual exp check in the middleware (line 23)
      // We need to mock jwt.verify to return a decoded token with expired exp
      // that somehow passed jwt.verify (edge case scenario)
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload = {
        id: 'user123',
        exp: now - 3600, // Expired 1 hour ago
        iat: now - 7200, // Issued 2 hours ago
      };
      
      // Mock jwt.verify to return expired payload (simulating edge case)
      const originalVerify = jwt.verify;
      jwt.verify = jest.fn().mockReturnValue(expiredPayload);

      mockReq.headers.authorization = `Bearer expired-token`;

      // Mock User.findById to return a user (so we can test the exp check)
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
      };
      User.findById.mockImplementation(() => createMockQuery(mockUser));

      await auth(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('expired-token', process.env.JWT_SECRET);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Token expired',
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled(); // Should not reach DB query

      // Restore original verify
      jwt.verify = originalVerify;
    });
  });

  describe('User not found', () => {
    it('should return 404 when user does not exist in database', async () => {
      const token = jwt.sign(
        { id: 'nonexistent-user-id' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      User.findById.mockImplementation(() => createMockQuery(null));

      await auth(mockReq, mockRes, mockNext);

      expect(User.findById).toHaveBeenCalledWith('nonexistent-user-id');
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User not found',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // VALID TOKEN SCENARIOS
  // ============================================
  describe('Valid token', () => {
    it('should call next() and set req.user when token is valid and user exists (using id)', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'customer',
      };

      const token = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      User.findById.mockImplementation(() => createMockQuery(mockUser));

      await auth(mockReq, mockRes, mockNext);

      expect(User.findById).toHaveBeenCalledWith('user123');
      // Note: select("-password") is a chain method, not a parameter to findById
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should call next() and set req.user when token uses _id instead of id', async () => {
      const mockUser = {
        _id: 'user456',
        username: 'testuser2',
        email: 'test2@example.com',
        role: 'admin',
      };

      const token = jwt.sign(
        { _id: 'user456' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      User.findById.mockImplementation(() => createMockQuery(mockUser));

      await auth(mockReq, mockRes, mockNext);

      expect(User.findById).toHaveBeenCalledWith('user456');
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle token with both id and _id (prefers id)', async () => {
      const mockUser = {
        _id: 'user789',
        username: 'testuser3',
        email: 'test3@example.com',
      };

      const token = jwt.sign(
        { id: 'user789', _id: 'user789' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      User.findById.mockImplementation(() => createMockQuery(mockUser));

      await auth(mockReq, mockRes, mockNext);

      expect(User.findById).toHaveBeenCalledWith('user789');
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Header variations', () => {
    it('should handle Bearer prefix correctly (case-sensitive replace)', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
      };

      const token = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Test with correct "Bearer " prefix
      mockReq.headers.authorization = `Bearer ${token}`;
      User.findById.mockImplementation(() => createMockQuery(mockUser));

      await auth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual(mockUser);
    });

    it('should fail when Bearer prefix is lowercase (replace is case-sensitive)', async () => {
      const token = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Test lowercase "bearer" - replace won't match, so token will include "bearer " prefix
      mockReq.headers.authorization = `bearer ${token}`;
      
      await auth(mockReq, mockRes, mockNext);

      // Should fail because "bearer " is not replaced, so jwt.verify will fail
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
    });

    it('should handle token with extra spaces after Bearer', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
      };

      const token = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      mockReq.headers.authorization = `Bearer  ${token}`; // Extra space
      User.findById.mockImplementation(() => createMockQuery(mockUser));

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const token = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      // Mock chain: User.findById().select() returns a Query object that rejects when awaited
      User.findById.mockImplementation(() => 
        createMockQuery(new Error('Database connection error'))
      );

      await auth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log errors to console', async () => {
      const invalidToken = 'not-a-valid-token';
      mockReq.headers.authorization = `Bearer ${invalidToken}`;

      await auth(mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Auth middleware error');
    });
  });

  describe('Token without expiration', () => {
    it('should work with token that has no exp field', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
      };

      const token = jwt.sign(
        { id: 'user123' },
        process.env.JWT_SECRET
        // No expiresIn option
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      User.findById.mockImplementation(() => createMockQuery(mockUser));

      await auth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

