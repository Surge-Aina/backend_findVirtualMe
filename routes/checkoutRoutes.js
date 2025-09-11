const express = require('express');
const router = express.Router();
const Stripe = require("stripe");


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
//payment intent
router.post('/payment-intent', async (req, res) => {
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
        id: paymentIntent.id 
      });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//checkout-session: sends users to stripe payment page
const PRICE_MAP = {
  basic: "price_1S32zY4RRTaBgmEqhHSUxiMT",   // $9/month
  pro: "price_1S32yN4RRTaBgmEqVX7uegSs",     // $29/month
};

router.post('/checkout-session', async (req, res) => {
  const { userId, plan } = req.body;

  if (!plan || !PRICE_MAP[plan]) {
    return res.status(400).json({ error: "Invalid plan selected" });
  }

  const lineItems = [
    {
      price: PRICE_MAP[plan],
      quantity: 1,
    }
  ];

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription", 
      line_items: lineItems,
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//get stripe session
router.get("/session/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id);
    res.json(session);
  } catch (err) {
    console.error("Failed to retrieve session:", err.response?.data || err.message);
    res.status(500).json({ error: err.message, message: "Failed to fetch session" });
  }
});


module.exports = router;
