const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");


const GuestAdminPanel = require("../guestAdminPanel.model").default || require("../guestAdminPanel.model");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("GuestAdminPanel Model", () => {
  it("should create a new admin panel entry with valid data", async () => {
    const validData = {
      name: "Admin Dashboard",
    };

    const adminPanel = new GuestAdminPanel(validData);
    const savedAdminPanel = await adminPanel.save();

    expect(savedAdminPanel._id).toBeDefined();
    expect(savedAdminPanel.name).toBe(validData.name);
    expect(savedAdminPanel.createdAt).toBeDefined();
    expect(savedAdminPanel.updatedAt).toBeDefined();
  });

  it("should create multiple admin panel entries", async () => {
    const entry1 = new GuestAdminPanel({ name: "Dashboard 1" });
    const entry2 = new GuestAdminPanel({ name: "Dashboard 2" });

    await entry1.save();
    await entry2.save();

    const entries = await GuestAdminPanel.find();
    expect(entries).toHaveLength(2);
  });

  it("should fail to create without required name field", async () => {
    const invalidData = new GuestAdminPanel({});

    let error;
    try {
      await invalidData.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.name.kind).toBe("required");
  });

  it("should fail validation with empty name", async () => {
    const invalidData = new GuestAdminPanel({ name: "" });

    let error;
    try {
      await invalidData.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
  });

  it("should have timestamps", async () => {
    const adminPanel = new GuestAdminPanel({ name: "Test Panel" });
    const saved = await adminPanel.save();

    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(saved.createdAt.getTime()).toBe(saved.updatedAt.getTime());
  });

  it("should update timestamp on modification", async () => {
    const adminPanel = new GuestAdminPanel({ name: "Original Name" });
    const saved = await adminPanel.save();
    
    const originalUpdatedAt = saved.updatedAt;

   
    await new Promise(resolve => setTimeout(resolve, 10));

    saved.name = "Updated Name";
    const updated = await saved.save();

    expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    expect(updated.name).toBe("Updated Name");
  });

  it("should find by name", async () => {
    await new GuestAdminPanel({ name: "Panel 1" }).save();
    await new GuestAdminPanel({ name: "Panel 2" }).save();

    const found = await GuestAdminPanel.findOne({ name: "Panel 1" });

    expect(found).toBeDefined();
    expect(found.name).toBe("Panel 1");
  });

  it("should delete an entry", async () => {
    const adminPanel = await new GuestAdminPanel({ name: "To Delete" }).save();
    
    await GuestAdminPanel.findByIdAndDelete(adminPanel._id);
    
    const found = await GuestAdminPanel.findById(adminPanel._id);
    expect(found).toBeNull();
  });

  it("should update an entry", async () => {
    const adminPanel = await new GuestAdminPanel({ name: "Original" }).save();
    
    const updated = await GuestAdminPanel.findByIdAndUpdate(
      adminPanel._id,
      { name: "Updated" },
      { new: true }
    );

    expect(updated.name).toBe("Updated");
  });
});