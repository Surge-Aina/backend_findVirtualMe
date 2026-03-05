// qrCode.routes.js
const express = require("express");
const controller = require("./qrCode.controller");
const auth = require("../../middleware/auth");

const router = express.Router();

//-----public routes------
//GET qrCode/public/byPortfolio?id=PORTFOLIO_ID&type=PORTFOLIO_TYPE
router.get("/public/byPortfolio", controller.getPublicQrCodesByPortfolio);
//GET qrCode/public?owner=USER_ID
router.get("/public", controller.getPublicQrCodes);
//GET qrCode/public/:id
router.get("/public/:id", controller.getOnePublicQrCode);

//-----protected routes-----
//get single qr code by id
router.get("/:id", auth, controller.getOneQrCode);
//create new qr code
router.post("/", auth, controller.createQrCode);
//update qr code by id
router.put("/:id", auth, controller.updateQrCode);
//delete qr code by id
router.delete("/:id", auth, controller.deleteQrCode);

module.exports = router;
