const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const domainCtrl = require("./DomainRouter.controller");

router.get("/routing-proxy", domainCtrl.routingProxy)

router.post("/", auth, domainCtrl.createDomainRoute);
router.get("/", auth, domainCtrl.getMyDomainRoutes);
router.patch("/:id", auth, domainCtrl.updateDomainRoute);
router.delete("/:id", auth, domainCtrl.deleteDomainRoute);


module.exports = router;
