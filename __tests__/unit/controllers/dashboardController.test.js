const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Dashboard = require('../../../models/dashboardModel');
const dashboardController = require('../../../controllers/dashboardController');

let mongoServer;

// Mock response and request objects
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockRequest = (body = {}, params = {}) => ({
  body,
  params
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Dashboard.deleteMany({});
});

describe('Dashboard Controller', () => {
  describe('getDashboard', () => {
    it('should return existing dashboard data', async () => {
      const dashboardData = {
        chartTitle: 'Test Chart',
        xAxisLabel: 'Test X',
        yAxisLabel: 'Test Y',
        data: {
          sales: [1, 2, 3],
          revenue: [100, 200, 300],
          xLabels: ['Jan', 'Feb', 'Mar'],
          hiddenPoints: []
        },
        categories: ['Test1', 'Test2'],
        categoryData: [50, 50]
      };

      await Dashboard.create(dashboardData);

      const req = mockRequest();
      const res = mockResponse();

      await dashboardController.getDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          chartTitle: 'Test Chart',
          xAxisLabel: 'Test X',
          yAxisLabel: 'Test Y'
        })
      );
    });

    it('should create default dashboard if none exists', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await dashboardController.getDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          chartTitle: 'Revenue Trend',
          xAxisLabel: 'Months',
          yAxisLabel: 'Revenue ($)'
        })
      );
    });
  });

  describe('updateDashboard', () => {
    it('should update existing dashboard data', async () => {
      const existingDashboard = await Dashboard.create({
        chartTitle: 'Old Title',
        isActive: true
      });

      const updateData = {
        chartTitle: 'New Title',
        xAxisLabel: 'New X'
      };

      const req = mockRequest(updateData);
      const res = mockResponse();

      await dashboardController.updateDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          chartTitle: 'New Title',
          xAxisLabel: 'New X'
        })
      );
    });

    it('should create new dashboard if none exists', async () => {
      const newData = {
        chartTitle: 'New Dashboard',
        xAxisLabel: 'New X',
        yAxisLabel: 'New Y'
      };

      const req = mockRequest(newData);
      const res = mockResponse();

      await dashboardController.updateDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          chartTitle: 'New Dashboard',
          xAxisLabel: 'New X',
          yAxisLabel: 'New Y'
        })
      );
    });
  });

  describe('createDashboard', () => {
    it('should create a new dashboard', async () => {
      const dashboardData = {
        chartTitle: 'Test Dashboard',
        xAxisLabel: 'Test X',
        yAxisLabel: 'Test Y',
        data: {
          sales: [1, 2, 3],
          revenue: [100, 200, 300],
          xLabels: ['Jan', 'Feb', 'Mar'],
          hiddenPoints: []
        }
      };

      const req = mockRequest(dashboardData);
      const res = mockResponse();

      await dashboardController.createDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          chartTitle: 'Test Dashboard',
          xAxisLabel: 'Test X',
          yAxisLabel: 'Test Y'
        })
      );
    });
  });

  describe('deleteDashboard', () => {
    it('should delete existing dashboard', async () => {
      const dashboard = await Dashboard.create({
        chartTitle: 'Test Dashboard'
      });

      const req = mockRequest({}, { id: dashboard._id.toString() });
      const res = mockResponse();

      await dashboardController.deleteDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dashboard deleted successfully'
      });
    });

    it('should return 404 if dashboard not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockRequest({}, { id: fakeId.toString() });
      const res = mockResponse();

      await dashboardController.deleteDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dashboard not found'
      });
    });
  });
});
