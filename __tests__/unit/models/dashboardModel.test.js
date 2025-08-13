const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Dashboard = require('../../../models/dashboardModel');

let mongoServer;

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

describe('Dashboard Model', () => {
  describe('Schema Validation', () => {
    it('should create dashboard with default values', async () => {
      const dashboard = new Dashboard();
      await dashboard.save();

      expect(dashboard.chartTitle).toBe('Revenue Trend');
      expect(dashboard.xAxisLabel).toBe('Months');
      expect(dashboard.yAxisLabel).toBe('Revenue ($)');
      expect(dashboard.categories).toEqual(['Electronics', 'Clothing', 'Books', 'Home', 'Sports']);
      expect(dashboard.categoryData).toEqual([35, 25, 20, 15, 5]);
      expect(dashboard.isActive).toBe(true);
      expect(dashboard.createdAt).toBeInstanceOf(Date);
      expect(dashboard.updatedAt).toBeInstanceOf(Date);
    });

    it('should create dashboard with custom values', async () => {
      const customData = {
        chartTitle: 'Custom Chart',
        xAxisLabel: 'Custom X',
        yAxisLabel: 'Custom Y',
        data: {
          sales: [10, 20, 30],
          revenue: [1000, 2000, 3000],
          xLabels: ['Q1', 'Q2', 'Q3'],
          hiddenPoints: [1]
        },
        categories: ['Category1', 'Category2'],
        categoryData: [60, 40],
        isActive: false
      };

      const dashboard = new Dashboard(customData);
      await dashboard.save();

      expect(dashboard.chartTitle).toBe('Custom Chart');
      expect(dashboard.xAxisLabel).toBe('Custom X');
      expect(dashboard.yAxisLabel).toBe('Custom Y');
      expect(dashboard.data).toEqual(customData.data);
      expect(dashboard.categories).toEqual(['Category1', 'Category2']);
      expect(dashboard.categoryData).toEqual([60, 40]);
      expect(dashboard.isActive).toBe(false);
    });

    it('should validate data structure', async () => {
      const dashboard = new Dashboard({
        data: {
          sales: [1, 2, 3],
          revenue: [100, 200, 300],
          xLabels: ['Jan', 'Feb', 'Mar'],
          hiddenPoints: []
        }
      });

      await dashboard.save();
      expect(dashboard.data.sales).toEqual([1, 2, 3]);
      expect(dashboard.data.revenue).toEqual([100, 200, 300]);
      expect(dashboard.data.xLabels).toEqual(['Jan', 'Feb', 'Mar']);
      expect(dashboard.data.hiddenPoints).toEqual([]);
    });
  });

  describe('Middleware', () => {
    it('should update updatedAt field before saving', async () => {
      const dashboard = new Dashboard({
        chartTitle: 'Test Chart'
      });

      const originalUpdatedAt = dashboard.updatedAt;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await dashboard.save();
      
      expect(dashboard.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should update updatedAt when document is modified', async () => {
      const dashboard = await Dashboard.create({
        chartTitle: 'Original Title'
      });

      const originalUpdatedAt = dashboard.updatedAt;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      dashboard.chartTitle = 'Updated Title';
      await dashboard.save();
      
      expect(dashboard.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(dashboard.chartTitle).toBe('Updated Title');
    });
  });

  describe('Data Types', () => {
    it('should handle array data types correctly', async () => {
      const dashboard = new Dashboard({
        data: {
          sales: [1, 2, 3, 4, 5],
          revenue: [1000, 2000, 3000, 4000, 5000],
          xLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          hiddenPoints: [2, 4]
        },
        categories: ['Tech', 'Finance', 'Healthcare'],
        categoryData: [40, 35, 25]
      });

      await dashboard.save();

      expect(Array.isArray(dashboard.data.sales)).toBe(true);
      expect(Array.isArray(dashboard.data.revenue)).toBe(true);
      expect(Array.isArray(dashboard.data.xLabels)).toBe(true);
      expect(Array.isArray(dashboard.data.hiddenPoints)).toBe(true);
      expect(Array.isArray(dashboard.categories)).toBe(true);
      expect(Array.isArray(dashboard.categoryData)).toBe(true);
    });

    it('should handle boolean isActive field', async () => {
      const activeDashboard = new Dashboard({ isActive: true });
      const inactiveDashboard = new Dashboard({ isActive: false });

      await activeDashboard.save();
      await inactiveDashboard.save();

      expect(activeDashboard.isActive).toBe(true);
      expect(inactiveDashboard.isActive).toBe(false);
    });
  });

  describe('Timestamps', () => {
    it('should set createdAt and updatedAt on creation', async () => {
      const dashboard = new Dashboard();
      await dashboard.save();

      expect(dashboard.createdAt).toBeInstanceOf(Date);
      expect(dashboard.updatedAt).toBeInstanceOf(Date);
      expect(dashboard.createdAt.getTime()).toBe(dashboard.updatedAt.getTime());
    });

    it('should only update updatedAt on modification', async () => {
      const dashboard = await Dashboard.create({
        chartTitle: 'Original Title'
      });

      const originalCreatedAt = dashboard.createdAt;
      const originalUpdatedAt = dashboard.updatedAt;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      dashboard.chartTitle = 'Modified Title';
      await dashboard.save();

      expect(dashboard.createdAt.getTime()).toBe(originalCreatedAt.getTime());
      expect(dashboard.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
