require("dotenv").config();
if (process.env.DNS_FIX === 'true') {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
const connectDB = require("./shared/utils/db");
const app = require("./index");
const { startOrphanImageGcCron } = require("./modules/media/gcOrphanImages");
const { startWebhookSweeper } = require("./modules/public-api/webhookDelivery");

const PORT = process.env.PORT;
connectDB()
  .then(() => {
    startOrphanImageGcCron();
    startWebhookSweeper();
    app.listen(PORT, () => {
      console.log(`listening on PORT:${PORT}`);
    });
  })
  .catch(() => {
    console.error("Database connection failed");
  });
