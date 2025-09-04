
require('dotenv').config();
const express = require("express");
const Stripe = require("stripe");

const app = express();

// Stripe Webhook 
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
        event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
    case "invoice.payment_failed":
        const failed_invoice = event.data.object;
        console.log("Invoice failed:" , failed_invoice);
        break;
    case "invoice.paid":
      const invoice = event.data.object;
      console.log("Invoice paid:", invoice.id);
      break;
    // ... handle other events
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

    res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});



app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT;
// Create Payment Intent
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
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



//create checkout session: opens stripe payment webpage
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { lineItems, success_url, cancel_url } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription", 
      line_items: lineItems,
      success_url,
      cancel_url,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/stripe/session/:id", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id);
    res.json(session);
  } catch (err) {
    console.error("Stripe session retrieval error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`Payment service running on ${port}`));
