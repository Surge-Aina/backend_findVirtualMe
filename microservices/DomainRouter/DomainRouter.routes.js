const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const domainCtrl = require("./DomainRouter.controller");
const DomainRoute = require("./DomainRouter.model");

// router.get("/resolve", async (req, res) => {
//   try {
//     const host = req.query.host?.toLowerCase();
//     if (!host) {
//       return res.status(400).json({ mapped: false });
//     }

//     const domain = host.replace(/^www\./, "");

//     const route = await DomainRoute.findOne({
//       domain,
//       isActive: true,
//     })
//       .select("portfolioType portfolioId")
//       .lean();

//     if (!route) {
//       return res.json({ mapped: false });
//     }

//     res.json({
//       mapped: true,
//       portfolioType: route.portfolioType,
//       portfolioId: route.portfolioId.toString(),
//     });
//   } catch (err) {
//     console.error("Domain resolve error:", err);
//     res.status(500).json({ mapped: false });
//   }
// });


// router.get("/routing-proxy",(req, res, next) => {
//   console.log("HIT routing-proxy route");
//   next();
// }, domainCtrl.routingProxy)

router.post("/", auth, domainCtrl.createDomainRoute);
router.get("/", auth, domainCtrl.getMyDomainRoutes);
router.patch("/:id", auth, domainCtrl.updateDomainRoute);
router.delete("/:id", auth, domainCtrl.deleteDomainRoute);

router.get("/domainLookup", domainCtrl.domainLookup);


module.exports = router;
