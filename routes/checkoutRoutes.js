const express = require('express');
const axios = require('axios');
const router = express.Router();
const payment_service_URL = process.env.PAYMENT_SERVICE_URL;

//payment intent
router.post('/payment-intent', async (req, res) => {
    const { userId, amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid order" });
    }

    try {
        const response = await axios.post(`${payment_service_URL}/create-payment-intent`, {
            amount,
            currency: "usd",
        });

        res.json(response.data); // returns clientSecret
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
    // call payment microservice to create a checkout session
    const response = await axios.post(`${payment_service_URL}/create-checkout-session`, {
      lineItems,
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment`,
    });

    res.json({ checkoutUrl: response.data.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/session/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const response = await axios.get(`${payment_service_URL}/stripe/session/${id}`);
    res.json(response.data);
  } catch (err) {
    console.error("Failed to retrieve session:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});


module.exports = router;
