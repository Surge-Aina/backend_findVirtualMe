// DomainRouter.routes.js
const express = require("express");
const { getDomainRouter } = require("./DomainRouter.controller");

const router = express.Router();

router.get("/", getDomainRouter);

module.exports = router;
