const express = require("express");
const subscriptionsController = require("../controllers/subscriptionsController");
const router = express.Router();

router.get("/", subscriptionsController.getAllSubscriptions);
router.get("/payments/:customerId", subscriptionsController.getPaymentHistory);
router.get("/reconcile", subscriptionsController.reconcileSubscriptions);
router.get("/:subscriptionId", subscriptionsController.getSubscriptionDetails);

router.put("/update", subscriptionsController.updateSubscription);
router.put("/cancel", subscriptionsController.cancelSubscription);
router.put("/cancel-immediately", subscriptionsController.cancelSubscriptionImmediately);
router.put("/reactivate", subscriptionsController.reactivateSubscription);

router.post("/refund", subscriptionsController.issueRefund);

module.exports = router;
