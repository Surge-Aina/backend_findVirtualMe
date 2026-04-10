const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { DomainRouteSchema } = require("../DomainRouter.model");

let mongo;
let connection;
let DomainRoute;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  connection = await mongoose.createConnection(mongo.getUri()).asPromise();
  DomainRoute = connection.model("DomainRoute", DomainRouteSchema);
});

afterAll(async () => {
  await connection.close();
  await mongo.stop();
});

afterEach(async () => {
  await connection.dropDatabase();
});

describe("DomainRoute pre-save hook", () => {
  test("strips www. and lowercases domain", async () => {
    const doc = new DomainRoute({
      domain: "www.MyDomain.com",
      userId: new mongoose.Types.ObjectId(),
    });
    await doc.save();
    expect(doc.domain).toBe("mydomain.com");
  });

  test("lowercases domain without www", async () => {
    const doc = new DomainRoute({
      domain: "EXAMPLE.COM",
      userId: new mongoose.Types.ObjectId(),
    });
    await doc.save();
    expect(doc.domain).toBe("example.com");
  });
});