const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../../shared/models/User");

const stripeSecretkey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;
const stripe = new Stripe(stripeSecretkey);

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

// Amount always comes from the Stripe Price for a known plan. Client amount is ignored.
async function amountForPlan(body) {
  const planKey = String(body?.plan || "").trim().toLowerCase();
  const requestedPrice = String(body?.priceId || body?.price || "").trim();
  let plan = "";
  let priceId = "";

  if (planKey && Object.prototype.hasOwnProperty.call(PRICE_MAP, planKey)) {
    plan = planKey;
    priceId = PRICE_MAP[planKey] || "";
  } else if (requestedPrice) {
    const match = Object.entries(PRICE_MAP).find(([, id]) => id && id === requestedPrice);
    if (!match) return null;
    plan = match[0];
    priceId = match[1];
  } else {
    return null;
  }

  if (!priceId) return null;
  const price = await stripe.prices.retrieve(priceId);
  const amount = price?.unit_amount;
  const currency = String(price?.currency || "").toLowerCase();
  if (!Number.isInteger(amount) || amount <= 0) return null;
  if (currency !== "usd" || price.active === false) return null;
  return { plan, amount, priceId };
}

router.post("/payment-intent", async (req, res) => {
  try {
    const priced = await amountForPlan(req.body || {});
    if (!priced) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: priced.amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        appUserId: String(req.user?._id || req.user?.id || ""),
        plan: priced.plan,
        priceId: priced.priceId,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      amount: priced.amount,
      currency: "usd",
      plan: priced.plan,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(["/session", "/checkout-session"], async (req, res) => {
  try {
    const user = req.user; // middleware auth populates this
    const { plan } = req.body; //"basic" or "pro"

    console.log("--------------------plan: ", plan);

    if (!plan || !PRICE_MAP[plan]) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    //if user does not have stripe customer ID create a new customer on stripe
    //and save the id to user in mongodb
    let stripeCustomerId = user.stripeCustomerId;
    if (!user.stripeCustomerId) {
      //create customer on stripe
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.email,
        metadata: { userId: user._id?.toString() },
      });

      stripeCustomerId = customer.id;

      //save stripeCustomerId to user
      await User.updateOne(
        { _id: user._id },
        { $set: { stripeCustomerId: stripeCustomerId } }
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
      // automatic_tax: { enabled: true }, // Enable automatic tax calculation( must have tax settings configured in Stripe dashboard)
      payment_method_types: ["card"],
      mode: "subscription",
      customer: stripeCustomerId,
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
    const ownerId = session.metadata?.appUserId
      ? String(session.metadata.appUserId)
      : "";
    const actorId = String(req.user?._id || req.user?.id || "");
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin && (!ownerId || ownerId !== actorId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
    });
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
      return res.json({ hasCustomer: true });
    }

    //create customer on stripe
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.email,
      metadata: { userId: user._id?.toString() },
    });

    user.stripeCustomerId = customer.id;
    await user.save();

    res.json({ hasCustomer: true });
  } catch (error) {
    console.error("error creating stripe customer:", error?.message || "stripe error");
    res.status(500).json({ message: "Error creating stripe customer", error: error });
  }
});

router.post("/billing-session", async (req, res) => {
  const frontEndUrl = process.env.FRONTEND_URL;

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
