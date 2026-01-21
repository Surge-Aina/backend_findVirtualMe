const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const domainCtrl = require("../controllers/domainController");

router.post("/", auth, domainCtrl.createDomainRoute);
router.get("/", auth, domainCtrl.getMyDomainRoutes);
router.patch("/:id", auth, domainCtrl.updateDomainRoute);
router.delete("/:id", auth, domainCtrl.deleteDomainRoute);

router.get("/routing-proxy", domainCtrl.routingProxy)

module.exports = router;
