const Subscriptions = require("../models/Subscriptions");
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.getAllSubscriptions = async (req, res) => {
  try {
    const subList = await Subscriptions.find().sort({ updatedAt: -1 });
    if (subList.length === 0) {
      return res.status(404).json({ message: "No Subscriptions found" });
    }
    res.status(200).json(subList);
  } catch (error) {
    console.log("error getting all subscriptions: ", error);
  }
};

exports.updateSubsFromStripe = async (req, res) => {
  try {
    // Get subscriptions from DB
    const subList = await Subscriptions.find();

    if (subList.length === 0) {
      return res.status(404).json({ message: "No Subscriptions found" });
    }

    // Pull fresh data from Stripe for each subscription
    const updatedSubs = await Promise.all(
      subList.map(async (subDoc) => {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(subDoc.subscriptionId);

          // Update local DB with latest Stripe info
          const updated = await Subscriptions.findByIdAndUpdate(
            subDoc._id,
            {
              status: stripeSub.status,
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
              canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
              priceId: stripeSub.items.data[0]?.price.id,
            },
            { new: true } // return updated doc
          );

          return updated;
        } catch (err) {
          console.error(`Error fetching subscription ${subDoc.subscriptionId}:`, err);
          return subDoc; // fallback to DB value
        }
      })
    );

    res.status(200).json(updatedSubs);
  } catch (error) {
    console.error("Error getting all subscriptions: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const PRICE_MAP = {
  basic: "price_1S32zY4RRTaBgmEqhHSUxiMT", // $9/month
  pro: "price_1S32yN4RRTaBgmEqVX7uegSs", // $29/month
};

exports.updateSubscription = async (req, res) => {
  try {
    const { subscriptionId, newPlan } = req.body;

    // Update on Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: PRICE_MAP[newPlan], // new price(plan)
        },
      ],
      proration_behavior: "create_prorations", // apply prorated charges
    });

    res.json({
      success: true,
      stripeSubscription: updatedSubscription,
    });
  } catch (err) {
    console.error("Error updating subscription:", err);
    res.status(500).json({ error: err.message });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true, // let user keep until end of billing cycle
    });

    res.json({
      success: true,
      stripeSubscription: canceledSubscription,
    });
  } catch (err) {
    console.error("Error canceling subscription:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.cancelSubscriptionImmediately = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

    res.json({ success: true, canceledSubscription });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.issueRefund = async (req, res) => {
  try {
    const { chargeId, amount, reason } = req.body;

    // Fetch charge and expand invoice
    const charge = await stripe.charges.retrieve(chargeId, { expand: ["invoice"] });
    let subscriptionId = charge.invoice?.subscription;

    // If no subscription from invoice, try to find it by customer
    if (!subscriptionId && charge.customer) {
      const subscriptions = await stripe.subscriptions.list({
        customer: charge.customer,
        status: "active",
        limit: 1,
      });
      subscriptionId = subscriptions.data[0]?.id;
    }

    // Issue refund
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amount, // in cents, omit for full refund
      reason: reason || "missing_cancel_reason",
      metadata: {
        refundReason: reason || "missing_cancel_reason",
      },
    });

    let subscriptionCanceled = false;

    // Decide on cancel behavior
    if (subscriptionId) {
      if (reason === "fraudulent" || reason === "requested_by_customer") {
        // Cancel subscription immediately
        await stripe.subscriptions.cancel(subscriptionId);
        subscriptionCanceled = true;
        console.log("refunded and canceled sub immediately for: ", charge.customer);
      } else if (reason === "duplicate") {
        // Don't alter sub, just refund duplicate
        subscriptionCanceled = false;
        console.log("refunded and kept sub for: ", charge.customer);
      }
    }

    //log refund
    await Subscriptions.findOneAndUpdate(
      { customerId: charge.customer },
      {
        $push: {
          refundLog: {
            refundId: refund.id,
            chargeId: chargeId,
            amount: refund.amount,
            currency: refund.currency,
            reason: refund.reason,
            status: refund.status,
            subscriptionCanceled,
            source: "admin_panel",
          },
        },
      }
    );

    res.json({
      success: true,
      refund,
      subscriptionCanceled,
      subscriptionId,
    });
  } catch (err) {
    console.error("Error issuing refund:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getSubscriptionDetails = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    // Get from both Stripe and your DB
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    const dbSubscription = await Subscriptions.findOne({ subscriptionId });

    res.json({
      stripe: stripeSubscription,
      database: dbSubscription,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.reactivateSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const reactivatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    res.json({ success: true, reactivatedSubscription });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const { customerId } = req.params;

    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 20,
    });
    res.json({ charges: charges.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
