
jest.mock('../../services/openAiService');

jest.mock('pdf-parse', () => {
  return jest.fn();
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Portfolio = require('../../models/projectManager/portfolioModel');
const pdfParse = require('pdf-parse');
const {
  generatePortfolioJSON,
  generateMatchSummary,
} = require('../../services/openAiService');
const {
  getPortfolioByEmail,
  getAllPortfoliosByEmail,
  getAllPortfolios,
  getPortfolioById,
  addPortfolio,
  addPDF,
  editPortfolioByEmail,
  deletePortfolioByEmail,
  aiSummary,
} = require('../../controllers/projectManager/portfolioController');

let mongoServer;
// ... rest of file stays the same

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  await Portfolio.deleteMany();
  jest.clearAllMocks();
});

describe('Portfolio Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();

    req = {
      params: {},
      query: {},
      body: {},
      file: null,
      user: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getPortfolioByEmail', () => {
    it('should return portfolio when found', async () => {
      const mockPortfolio = await Portfolio.create({
        name: 'John Doe',
        email: 'john@example.com',
        title: 'Developer',
      });

      req.params.email = 'john@example.com';

      await getPortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'john@example.com',
          name: 'John Doe',
        })
      );
    });

    it('should return 404 when portfolio not found', async () => {
      req.params.email = 'notfound@example.com';

      await getPortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'portfolio not found' });
    });

    it('should return 500 on database error', async () => {
      req.params.email = 'test@example.com';
      jest.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(new Error('DB Error'));

      await getPortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'error getting portfolio' });
    });
  });

  // ============================================
  // GET ALL PORTFOLIOS BY EMAIL
  // ============================================
  describe('getAllPortfoliosByEmail', () => {
  it('should return all portfolios for an email', async () => {
    await Portfolio.create([
      { name: 'Portfolio 1', email: 'user1@example.com', title: 'Dev' },   // ✅ Different emails
      { name: 'Portfolio 2', email: 'user2@example.com', title: 'PM' },    // ✅ Different emails
    ]);

    req.params.email = 'user1@example.com';  // ✅ Search for user1

    await getAllPortfoliosByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Portfolio 1' }),
      ])
    );
  });

});
  
  describe('getAllPortfolios', () => {
    it('should return all portfolios', async () => {
      await Portfolio.create([
        { name: 'Portfolio 1', email: 'user1@example.com', title: 'Dev' },
        { name: 'Portfolio 2', email: 'user2@example.com', title: 'PM' },
      ]);

      await getAllPortfolios(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'Portfolio 1' }),
        expect.objectContaining({ name: 'Portfolio 2' }),
      ]));
    });

    it('should return 404 when no portfolios exist', async () => {
      await getAllPortfolios(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'No portfolios found' });
    });

    it('should return 500 on error', async () => {
      jest.spyOn(Portfolio, 'find').mockRejectedValueOnce(new Error('DB Error'));

      await getAllPortfolios(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPortfolioById', () => {
    it('should return portfolio by ID', async () => {
      const portfolio = await Portfolio.create({
        name: 'John Doe',
        email: 'john@example.com',
        title: 'Developer',
      });

      req.params.id = portfolio._id.toString();

      await getPortfolioById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
        })
      );
    });

    it('should return 404 when portfolio not found', async () => {
      req.params.id = new mongoose.Types.ObjectId().toString();

      await getPortfolioById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'portfolio not found' });
    });

    it('should return 500 on invalid ID', async () => {
      req.params.id = 'invalid-id';

      await getPortfolioById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });


  describe('addPortfolio', () => {
    it('should create portfolio successfully', async () => {
      req.body.portfolio = {
        firstName: 'John',
        lastName: 'Doe',
        industry: 'Software Engineering',
        email: 'john@example.com',
        phone: '123-456-7890',
        location: 'San Francisco',
        goal: 'Become a senior engineer',
        skills: ['JavaScript', 'React', 'Node.js'],
      };

      await addPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          title: 'Software Engineering',
        })
      );
    });

    it('should return 400 if portfolio is missing', async () => {
      req.body.portfolio = null;

      await addPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'portfolio needed' });
    });

    it('should return 500 on save error', async () => {
      req.body.portfolio = {
        firstName: 'John',
        lastName: 'Doe',
        industry: 'Tech',
        email: 'john@example.com',
        phone: '123',
        location: 'SF',
        goal: 'Test',
        skills: ['JS'],
      };

      jest.spyOn(Portfolio.prototype, 'save').mockRejectedValueOnce(new Error('Save failed'));

      await addPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });


  describe('addPDF', () => {
    it('should upload PDF and create portfolio', async () => {
      req.file = {
        buffer: Buffer.from('mock PDF content'),
        originalname: 'resume.pdf',
      };
      req.body.email = 'john@example.com';

      pdfParse.mockResolvedValue({
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        text: 'John Doe\nSoftware Engineer',
      });

      const mockPortfolioJSON = JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        title: 'Software Engineer',
        skills: ['JavaScript'],
      });

      generatePortfolioJSON.mockResolvedValue(mockPortfolioJSON);

      await addPDF(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
        })
      );
    });

    it('should handle sessionId', async () => {
      req.file = {
        buffer: Buffer.from('mock PDF'),
        originalname: 'resume.pdf',
      };
      req.body.email = 'john@example.com';
      req.body.sessionId = 'session123';

      pdfParse.mockResolvedValue({
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        text: 'Resume text',
      });

      generatePortfolioJSON.mockResolvedValue(JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
      }));

      await addPDF(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session123',
        })
      );
    });

    it('should return 400 if no file uploaded', async () => {
      req.file = null;

      await addPDF(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No PDF file uploaded' });
    });

    it('should return 500 if PDF parsing fails', async () => {
      req.file = {
        buffer: Buffer.from('mock PDF'),
      };
      req.body.email = 'john@example.com';

      pdfParse.mockRejectedValue(new Error('Parse error'));

      await addPDF(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to parse PDF' });
    });

    it('should return 500 if OpenAI fails', async () => {
      req.file = {
        buffer: Buffer.from('mock PDF'),
      };
      req.body.email = 'john@example.com';

      pdfParse.mockResolvedValue({
        numpages: 1,
        text: 'Resume text',
      });

      generatePortfolioJSON.mockRejectedValue(new Error('OpenAI error'));

      await addPDF(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('editPortfolioByEmail', () => {
    it('should update portfolio successfully', async () => {
      await Portfolio.create({
        name: 'Old Name',
        email: 'test@example.com',
        title: 'Developer',
      });

      req.user = { email: 'test@example.com' };
      req.body.portfolio = {
        name: 'New Name',
        title: 'Senior Developer',
      };

      await editPortfolioByEmail(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Name',
          title: 'Senior Developer',
        })
      );
    });

    it('should return 404 if portfolio not found', async () => {
      req.user = { email: 'notfound@example.com' };
      req.body.portfolio = { name: 'Test' };

      await editPortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'item not found' });
    });

    it('should return 500 on update error', async () => {
      req.user = { email: 'test@example.com' };
      req.body.portfolio = { name: 'Test' };

      jest.spyOn(Portfolio, 'findOneAndUpdate').mockRejectedValueOnce(new Error('Update error'));

      await editPortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });


  describe('deletePortfolioByEmail', () => {
    it('should delete portfolio successfully', async () => {
      await Portfolio.create({
        name: 'John Doe',
        email: 'john@example.com',
        title: 'Developer',
      });

      req.query.email = 'john@example.com';

      await deletePortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'item deleted successfully!' });
    });

    it('should return 404 if portfolio not found', async () => {
      req.query.email = 'notfound@example.com';

      await deletePortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'item not found' });
    });

    it('should return 500 on delete error', async () => {
      req.query.email = 'test@example.com';

      jest.spyOn(Portfolio, 'findOneAndDelete').mockRejectedValueOnce(new Error('Delete error'));

      await deletePortfolioByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });


  describe('aiSummary', () => {
    it('should generate AI summary successfully', async () => {
      const mockSummary = '✓ Matches: JavaScript\n✗ Missing: Python';
      generateMatchSummary.mockResolvedValue(mockSummary);

      req.body = {
        resumeJSON: { name: 'John Doe', skills: ['JavaScript'] },
        jobText: 'Looking for JavaScript developer',
      };

      await aiSummary(req, res);

      expect(res.json).toHaveBeenCalledWith({ summary: mockSummary });
      expect(generateMatchSummary).toHaveBeenCalledWith(
        req.body.resumeJSON,
        req.body.jobText
      );
    });

    it('should return 400 if resumeJSON is missing', async () => {
      req.body = { jobText: 'Job description' };

      await aiSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing input' });
    });

    it('should return 400 if jobText is missing', async () => {
      req.body = { resumeJSON: { name: 'John' } };

      await aiSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing input' });
    });

    it('should return 500 if OpenAI fails', async () => {
      req.body = {
        resumeJSON: { name: 'John' },
        jobText: 'Job text',
      };

      generateMatchSummary.mockRejectedValue(new Error('OpenAI error'));

      await aiSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Generation failed' });
    });
  });
});