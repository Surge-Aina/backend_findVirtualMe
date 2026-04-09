require("dotenv").config();
if (process.env.DNS_FIX === 'true') {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
const connectDB = require("./utils/db");
const app = require("./index");
const { startOrphanImageGcCron } = require("./microservices/S3Upload/gcOrphanImages");

const PORT = process.env.PORT;
connectDB()
  .then(() => {
    startOrphanImageGcCron();
    app.listen(PORT, () => {
      console.log(`listening on PORT:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed: ", error);
  });
