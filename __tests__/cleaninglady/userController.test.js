
jest.mock('../../models/cleaningLady/userModel2');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const User = require('../../models/cleaningLady/userModel2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { signupUser, loginUser } = require('../../controllers/cleaningLady/userController2');

describe('User Controller Tests (Cleaning Lady)', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Set mock JWT secret
    process.env.JWT_SECRET = 'test-secret-key';
  });

  
  describe('signupUser', () => {
    describe('✅ Success Cases', () => {
      it('should create new user successfully', async () => {
        req.body = {
          email: 'newuser@example.com',
          password: 'password123',
        };

        User.findOne.mockResolvedValue(null); // No existing user
        bcrypt.hash.mockResolvedValue('hashedPassword123');
        
        const mockUser = {
          _id: 'user123',
          email: 'newuser@example.com',
          password: 'hashedPassword123',
          isAdmin: false,
        };
        User.create.mockResolvedValue(mockUser);
        
        jwt.sign.mockReturnValue('mock.jwt.token');

        await signupUser(req, res);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'newuser@example.com' });
        expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
        expect(User.create).toHaveBeenCalledWith({
          email: 'newuser@example.com',
          password: 'hashedPassword123',
          isAdmin: false,
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          email: 'newuser@example.com',
          isAdmin: false,
          token: 'mock.jwt.token',
        });
      });

      it('should create admin user when isAdmin is true', async () => {
        req.body = {
          email: 'admin@example.com',
          password: 'adminpass123',
          isAdmin: true,
        };

        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashedAdminPass');
        
        const mockAdmin = {
          _id: 'admin123',
          email: 'admin@example.com',
          password: 'hashedAdminPass',
          isAdmin: true,
        };
        User.create.mockResolvedValue(mockAdmin);
        jwt.sign.mockReturnValue('admin.jwt.token');

        await signupUser(req, res);

        expect(User.create).toHaveBeenCalledWith({
          email: 'admin@example.com',
          password: 'hashedAdminPass',
          isAdmin: true,
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          email: 'admin@example.com',
          isAdmin: true,
          token: 'admin.jwt.token',
        });
      });

      it('should convert email to lowercase and trim', async () => {
        req.body = {
          email: '  UPPERCASE@EXAMPLE.COM  ',
          password: 'password123',
        };

        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockResolvedValue({
          _id: 'user123',
          email: 'uppercase@example.com',
          isAdmin: false,
        });
        jwt.sign.mockReturnValue('token');

        await signupUser(req, res);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'uppercase@example.com' });
        expect(User.create).toHaveBeenCalledWith({
          email: 'uppercase@example.com',
          password: 'hashed',
          isAdmin: false,
        });
      });

      it('should default isAdmin to false when not provided', async () => {
        req.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockResolvedValue({
          _id: 'user123',
          email: 'user@example.com',
          isAdmin: false,
        });
        jwt.sign.mockReturnValue('token');

        await signupUser(req, res);

        expect(User.create).toHaveBeenCalledWith(
          expect.objectContaining({ isAdmin: false })
        );
      });

      it('should generate JWT token with correct payload', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed');
        
        const mockUser = {
          _id: 'userId123',
          email: 'test@example.com',
          isAdmin: false,
        };
        User.create.mockResolvedValue(mockUser);
        jwt.sign.mockReturnValue('token');

        await signupUser(req, res);

        expect(jwt.sign).toHaveBeenCalledWith(
          {
            id: 'userId123',
            email: 'test@example.com',
            isAdmin: false,
          },
          'test-secret-key',
          { expiresIn: '7d' }
        );
      });
    });

    describe('❌ Validation Errors', () => {
      it('should return 400 if email is missing', async () => {
        req.body = {
          password: 'password123',
        };

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Email and password are required',
        });
        expect(User.findOne).not.toHaveBeenCalled();
      });

      it('should return 400 if password is missing', async () => {
        req.body = {
          email: 'test@example.com',
        };

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Email and password are required',
        });
      });

      it('should return 400 if both email and password are missing', async () => {
        req.body = {};

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 400 if email is empty string', async () => {
        req.body = {
          email: '',
          password: 'password123',
        };

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 400 if password is empty string', async () => {
        req.body = {
          email: 'test@example.com',
          password: '',
        };

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('❌ Duplicate User Errors', () => {
      it('should return 400 if user already exists', async () => {
        req.body = {
          email: 'existing@example.com',
          password: 'password123',
        };

        User.findOne.mockResolvedValue({
          _id: 'existingUser',
          email: 'existing@example.com',
        });

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'User already exists',
        });
        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(User.create).not.toHaveBeenCalled();
      });

      it('should check for existing user case-insensitively', async () => {
        req.body = {
          email: 'EXISTING@EXAMPLE.COM',
          password: 'password123',
        };

        User.findOne.mockResolvedValue({
          _id: 'existingUser',
          email: 'existing@example.com',
        });

        await signupUser(req, res);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'existing@example.com' });
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('💥 Server Errors', () => {
      it('should return 500 if User.findOne throws error', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        User.findOne.mockRejectedValue(new Error('Database error'));

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Database error',
        });
      });

      it('should return 500 if bcrypt.hash fails', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockRejectedValue(new Error('Hashing error'));

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });

      it('should return 500 if User.create fails', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockRejectedValue(new Error('Create error'));

        await signupUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });


  describe('loginUser', () => {
    describe('✅ Success Cases - Hashed Password', () => {
      it('should login successfully with hashed password', async () => {
        req.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        const mockUser = {
          _id: 'user123',
          email: 'user@example.com',
          password: '$2a$10$hashedPassword',
          isAdmin: false,
        };

        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('login.jwt.token');

        await loginUser(req, res);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
        expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$2a$10$hashedPassword');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          email: 'user@example.com',
          isAdmin: false,
          token: 'login.jwt.token',
        });
      });

      it('should login admin user with hashed password', async () => {
        req.body = {
          email: 'admin@example.com',
          password: 'adminpass',
        };

        const mockAdmin = {
          _id: 'admin123',
          email: 'admin@example.com',
          password: '$2b$10$hashedAdminPass',
          isAdmin: true,
        };

        User.findOne.mockResolvedValue(mockAdmin);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('admin.token');

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          email: 'admin@example.com',
          isAdmin: true,
          token: 'admin.token',
        });
      });

      it('should handle email case-insensitively', async () => {
        req.body = {
          email: '  USER@EXAMPLE.COM  ',
          password: 'password123',
        };

        const mockUser = {
          _id: 'user123',
          email: 'user@example.com',
          password: '$2a$10$hashed',
          isAdmin: false,
        };

        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('token');

        await loginUser(req, res);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('✅ Success Cases - Plaintext Password (Legacy)', () => {
      it('should login with plaintext password and upgrade to hash', async () => {
        req.body = {
          email: 'legacy@example.com',
          password: 'plaintextPass',
        };

        const mockUser = {
          _id: 'legacy123',
          email: 'legacy@example.com',
          password: 'plaintextPass', // Not hashed!
          isAdmin: true,
          save: jest.fn().mockResolvedValue(true),
        };

        User.findOne.mockResolvedValue(mockUser);
        bcrypt.hash.mockResolvedValue('$2a$10$newHashedPassword');
        jwt.sign.mockReturnValue('legacy.token');

        await loginUser(req, res);

        expect(bcrypt.compare).not.toHaveBeenCalled(); // Plaintext, so no compare
        expect(bcrypt.hash).toHaveBeenCalledWith('plaintextPass', 10);
        expect(mockUser.save).toHaveBeenCalled();
        expect(mockUser.password).toBe('$2a$10$newHashedPassword');
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should login even if upgrade to hash fails', async () => {
        req.body = {
          email: 'legacy@example.com',
          password: 'plaintextPass',
        };

        const mockUser = {
          _id: 'legacy123',
          email: 'legacy@example.com',
          password: 'plaintextPass',
          isAdmin: false,
          save: jest.fn().mockRejectedValue(new Error('Save failed')),
        };

        User.findOne.mockResolvedValue(mockUser);
        bcrypt.hash.mockResolvedValue('$2a$10$newHash');
        jwt.sign.mockReturnValue('token');

        await loginUser(req, res);

        // Should still login successfully even if upgrade fails
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'legacy@example.com',
            token: 'token',
          })
        );
      });
    });

    describe('❌ Validation Errors', () => {
      it('should return 400 if email is missing', async () => {
        req.body = {
          password: 'password123',
        };

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'All fields must be filled out',
        });
        expect(User.findOne).not.toHaveBeenCalled();
      });

      it('should return 400 if password is missing', async () => {
        req.body = {
          email: 'test@example.com',
        };

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'All fields must be filled out',
        });
      });

      it('should return 400 if both fields are missing', async () => {
        req.body = {};

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 400 if email is empty string', async () => {
        req.body = {
          email: '',
          password: 'password123',
        };

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('❌ Authentication Errors', () => {
      it('should return 400 if user not found', async () => {
        req.body = {
          email: 'nonexistent@example.com',
          password: 'password123',
        };

        User.findOne.mockResolvedValue(null);

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'User not found',
        });
      });

      it('should return 400 if hashed password is invalid', async () => {
        req.body = {
          email: 'user@example.com',
          password: 'wrongPassword',
        };

        const mockUser = {
          _id: 'user123',
          email: 'user@example.com',
          password: '$2a$10$hashedPassword',
          isAdmin: false,
        };

        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(false); // Wrong password

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Invalid credentials',
        });
      });

      it('should return 400 if plaintext password is invalid', async () => {
        req.body = {
          email: 'legacy@example.com',
          password: 'wrongPass',
        };

        const mockUser = {
          _id: 'legacy123',
          email: 'legacy@example.com',
          password: 'correctPass', // Plaintext
          isAdmin: false,
        };

        User.findOne.mockResolvedValue(mockUser);

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Invalid credentials',
        });
      });
    });

    describe('💥 Server Errors', () => {
      it('should return 500 if User.findOne throws error', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        User.findOne.mockRejectedValue(new Error('Database error'));

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Database error',
        });
      });

      it('should return 500 if bcrypt.compare throws error', async () => {
        req.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        const mockUser = {
          _id: 'user123',
          email: 'user@example.com',
          password: '$2a$10$hashed',
          isAdmin: false,
        };

        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockRejectedValue(new Error('Compare error'));

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('🔐 JWT Token Generation', () => {
      it('should generate JWT with correct payload for regular user', async () => {
        req.body = {
          email: 'user@example.com',
          password: 'password123',
        };

        const mockUser = {
          _id: 'userId456',
          email: 'user@example.com',
          password: '$2a$10$hashed',
          isAdmin: false,
        };

        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('generated.token');

        await loginUser(req, res);

        expect(jwt.sign).toHaveBeenCalledWith(
          {
            id: 'userId456',
            email: 'user@example.com',
            isAdmin: false,
          },
          'test-secret-key',
          { expiresIn: '7d' }
        );
      });

      it('should generate JWT with correct payload for admin user', async () => {
        req.body = {
          email: 'admin@example.com',
          password: 'adminpass',
        };

        const mockAdmin = {
          _id: 'adminId789',
          email: 'admin@example.com',
          password: '$2a$10$hashed',
          isAdmin: true,
        };

        User.findOne.mockResolvedValue(mockAdmin);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('admin.token');

        await loginUser(req, res);

        expect(jwt.sign).toHaveBeenCalledWith(
          {
            id: 'adminId789',
            email: 'admin@example.com',
            isAdmin: true,
          },
          'test-secret-key',
          { expiresIn: '7d' }
        );
      });
    });
  });
});