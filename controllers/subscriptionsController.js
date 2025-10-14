const Subscriptions = require("../models/Subscriptions");
const Stripe = require("stripe");

const stripeSecretkey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;
const stripe = new Stripe(stripeSecretkey);

const PRICE_MAP = {
  // $10/month
  basic:
    process.env.STRIPE_MODE === "live"
      ? process.env.PRICE_BASIC_LIVE
      : process.env.PRICE_BASIC_TEST,
  // $20/month
  pro:
    process.env.STRIPE_MODE === "live"
      ? process.env.PRICE_PRO_LIVE
      : process.env.PRICE_PRO_TEST,
};

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

//update current databse with data from stripe (only updates subs we already have in mongo database)
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
              canceledAt: stripeSub.canceled_at
                ? new Date(stripeSub.canceled_at * 1000)
                : null,
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

//update mongodb database with stripe data including records that may be missing in mongodb
exports.reconcileSubscriptions = async (req, res) => {
  try {
    //Fetch all local subscriptions
    const mongodbSubs = await Subscriptions.find();
    const mongodbSubsMap = new Map(mongodbSubs.map((s) => [s.subscriptionId, s]));

    //Fetch all Stripe subscriptions with pagination
    let stripeSubs = [];
    let hasMore = true;
    let lastId = null;

    while (hasMore) {
      const params = {
        limit: 100,
        expand: [
          "data.customer",
          "data.items.data.price",
          "data.latest_invoice.payment_intent.charges",
          "data.discounts.coupon",
        ],
      };
      if (lastId) params.starting_after = lastId;

      const res = await stripe.subscriptions.list(params);
      stripeSubs = stripeSubs.concat(res.data);

      hasMore = res.has_more;
      if (res.data.length > 0) {
        lastId = res.data[res.data.length - 1].id;
      }
    }

    let createdRecordsCount = 0;
    //create subscription object for each record in stripe and
    //either update existing one or create new one if missing from database
    const updatedSubs = await Promise.all(
      stripeSubs.map(async (stripeSub) => {
        const existing = mongodbSubsMap.get(stripeSub.id);

        const updatedSub = {
          subscriptionId: stripeSub.id,
          customerId: stripeSub.customer.id,
          email: stripeSub.customer.email,
          name: stripeSub.customer.name,
          status: stripeSub.status,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          currentPeriodStart: new Date(
            stripeSub.items.data[0].current_period_start * 1000
          ),
          currentPeriodEnd: new Date(stripeSub.items.data[0].current_period_end * 1000),
          createdAt: new Date(stripeSub.created * 1000),
          canceledAt: stripeSub.canceled_at
            ? new Date(stripeSub.canceled_at * 1000)
            : null,
          priceId: stripeSub.items.data[0]?.price.id,
          latestInvoiceId: stripeSub.latest_invoice?.id,
          paymentIntentId: stripeSub.latest_invoice?.payment_intent?.id,
          defaultPaymentMethodId: stripeSub.default_payment_method,
          coupon: stripeSub.discounts?.coupon?.id || null,
          discountEnd: stripeSub.discounts?.end
            ? new Date(stripeSub.discounts.end * 1000)
            : null,
          subscriptionItems: stripeSub.items.data.map((item) => ({
            itemId: item.id,
            priceId: item.price.id,
            quantity: item.quantity,
            active: item.price.active,
          })),
        };

        if (existing) {
          // Update existing subscription
          return await Subscriptions.findByIdAndUpdate(existing._id, updatedSub, {
            new: true,
          });
        } else {
          // Create missing subscription
          createdRecordsCount++;
          return await Subscriptions.create(updatedSub);
        }
      })
    );

    console.log(`Total reconciled ${updatedSubs.length} subscriptions`);
    console.log(
      `Created ${createdRecordsCount} new records that were missing in mongoDB`
    );
    res.status(200).json({
      updatedSubs,
      total_reconciled: updatedSubs.length,
      new_records: createdRecordsCount,
    });
  } catch (error) {
    console.error("Error reconciling subscriptions:", error);
    res.status(500).json({ message: "Error reconciling subscriptions:", error: error });
  }
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
