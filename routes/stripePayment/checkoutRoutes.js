const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../../models/User");

const stripeSecretkey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;
const stripe = new Stripe(stripeSecretkey);

//payment intent
router.post("/payment-intent", async (req, res) => {
  const { userId, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid order" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//checkout-session: sends users to stripe payment page
const PRICE_MAP = {
  basic:
    process.env.STRIPE_MODE === "live"
      ? process.env.PRICE_BASIC_LIVE
      : process.env.PRICE_BASIC_TEST, // $9/month
  pro:
    process.env.STRIPE_MODE === "live"
      ? process.env.PRICE_PRO_LIVE
      : process.env.PRICE_PRO_TEST, // $29/month
};

router.post("/checkout-session", async (req, res) => {
  try {
    const user = req.user; // middleware auth populates this
    const { plan } = req.body; //"basic" or "pro"

    console.log("--------------------plan: ", plan);

    if (!plan || !PRICE_MAP[plan]) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // //check if stripe customer has active subscriptions
    // //redirect to billing if so
    // if (user.stripeCustomerId) {
    //   const subscriptions = await stripe.subscriptions.list({
    //     customer: user.stripeCustomerId,
    //     status: { in: ["active", "trialing", "past_due"] },
    //     limit: 1,
    //   });

    //   //redirect to billing
    //   if (subscriptions.data.length > 0) {
    //     const portalSession = await stripe.billingPortal.sessions.create({
    //       customer: user.stripeCustomerId,
    //       return_url: `${process.env.FRONTEND_URL}/profile`,
    //     });

    //     //save subscriptionID to user
    //     user.stripeSubscriptionId = subscriptions.data[0].id;
    //     user.save();

    //     return res.json({ checkoutUrl: portalSession.url });
    //   }
    // }

    //if user does not have stripe customer ID create a new customer on stripe
    //and save the id to user in mongodb
    if (!user.stripeCustomerId) {
      //create customer on stripe
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.email,
        metadata: { userId: user._id?.toString() },
      });

      //save stripeCustomerId to user
      await User.updateOne(
        { _id: user._id },
        { $set: { stripeCustomerId: customer.id } }
      );
    }

    const lineItems = [
      {
        price: PRICE_MAP[plan],
        quantity: 1,
      },
    ];

    //create checkout session using stripe customer ID
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: user.stripeCustomerId,
      line_items: lineItems,
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/profile`,
      metadata: {
        appUserId: user._id?.toString(),
      },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("error creating checkout session: ", err);
    res
      .status(500)
      .json({ message: "error creating checkout session", error: err.message });
  }
});

//get stripe session
router.get("/session/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    res.json(session);
  } catch (err) {
    console.error("Failed to retrieve session:", err.response?.data || err.message);
    res.status(500).json({ error: err.message, message: "Failed to fetch session" });
  }
});

router.post("/create-customer", async (req, res) => {
  try {
    const user = req.user; //passed by auth middleware

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    //already has stripe customerId
    if (user.stripeCustomerId) {
      return res.json({ customerId: user.stripeCustomerId });
    }

    //create customer on stripe
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.email,
      metadata: { userId: user._id?.toString() },
    });

    user.stripeCustomerId = customer.id;
    await user.save();

    res.json({ customerId: customer.id });
  } catch (error) {
    console.error("error creating stripe customer: ", error);
    res.status(500).json({ message: "Error creating stripe customer", error: error });
  }
});

router.post("/billing-session", async (req, res) => {
  frontEndUrl = process.env.FRONTEND_URL;

  try {
    const user = req.user; // middleware auth populates this

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontEndUrl}/profile`,
    });

    res.json({ billingSessionUrl: session.url });
  } catch (error) {
    console.error("error creating stripe billing session: ", error);
    res.status(500).json({ message: "Error creating stripe billing session", error });
  }
});

module.exports = router;
