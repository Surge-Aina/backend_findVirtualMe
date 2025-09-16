const express = require('express');
const subscriptionsController = require('../controllers/adminSubscriptionsController');
const router = express.Router();

//get
router.get("/getSubscriptions", subscriptionsController.getAllSubscriptions);
//post

//patch
router.patch("/updateSubscription", subscriptionsController.updateSubscription)
router.patch("/cancelSubscription", subscriptionsController.cancelSubscription)
//delete

module.exports = router;