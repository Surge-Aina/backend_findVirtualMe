const publicRouter = require("./publicApi.routes");
const { renderDocsPage } = require("./docsPage");

function mountPublicApi(app) {
  app.get("/api/public/docs", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.type("html").send(renderDocsPage());
  });
  app.use("/api/public/v1", publicRouter);
}

module.exports = { mountPublicApi };
