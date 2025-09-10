const express = require('express');
const { getAllSubscriptions } = require('../controllers/adminSubscriptionsController');
const router = express.Router();

//get
router.get("/subscriptions", express.json(), getAllSubscriptions);
//post

//patch

//delete


//webhooks
//router.post("/webhook", express.raw({type: "application/json"}), webhookController);

module.exports = router;