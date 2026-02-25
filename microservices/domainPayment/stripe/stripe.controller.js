const { applyDomainVoucher } = require("../../vouchers/voucher.service");
const { redeemVoucher } = require("../../vouchers/voucher.service");
const stripeSecretkey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;
const stripe = require("stripe")(stripeSecretkey);
const { checkDomainAndGetPrice } = require("../services/pricing.service");
const { handleFulfillment } = require("../services/fulfillment.service");

/**
 * Handles POST /api/payment/checkout
 * Creates a Stripe Checkout Session.
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const { domain, voucherId } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!domain || !userId) {
      return res.status(400).json({ error: "Missing domain, or portfolio ID." });
    }

    // 1. Always calculate price server-side
    const priceData = await checkDomainAndGetPrice(domain);
    if (!priceData.available)
      return res.status(400).json({ error: "Domain not available" });

    let finalPrice = priceData.totalPrice;
    let appliedVoucher = null;

    // 2. Apply voucher if provided
    if (voucherId) {
      const result = await applyDomainVoucher(userId, finalPrice);
      finalPrice = result.finalPrice;
      appliedVoucher = result.voucher;
    }

    const amountInCents = Math.round(finalPrice * 100);

    const BASE_URL = process.env.FRONTEND_URL;
    if (!BASE_URL || !BASE_URL.startsWith("http")) {
      // Fallback or explicit error if the crucial environment variable is missing
      return res.status(500).json({
        error: "Server Configuration Error: CLIENT_BASE_URL is not set correctly.",
      });
    }
    const session = await stripe.checkout.sessions.create({
      adaptive_pricing: { enabled: true},
      automatic_tax: { enabled: true },
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Domain Registration: ${domain}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      // CRITICAL: Metadata for fulfillment. Must be strings.
      metadata: {
        domain,
        userId: userId.toString(),
        voucherId: appliedVoucher?._id?.toString() || "",
      },
      success_url: `${BASE_URL}/profile?tab=Domain+Management&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/profile?tab=Domain+Management&domain=${domain}`,
      customer_email: userEmail,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ error: "Failed to initiate payment." });
  }
};

/**
 * Handles POST /api/payment/webhook
 * Verifies and processes the Stripe payment fulfillment.
 */
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_PURCHASE_DOMAIN;
  let event;

  try {
    // 1. Verify the event signature using the raw body
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Domain Purchase Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Domain Purchase Webhook Error: ${err.message}`);
  }

  // 2. Handle the event type
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log(`Checkout session ${session.id} completed! Initiating fulfillment.`);

    const { domain, userId, voucherId } = session.metadata;
    console.log("Metadata extracted from session:", { domain, userId, voucherId });
    const paymentIntentId = session.payment_intent; // Charge ID for potential refund

    // 3. Trigger the asynchronous fulfillment service
    // NOTE: We don't wait for fulfillment here. We respond 200 immediately to Stripe.
    handleFulfillment(domain, userId, paymentIntentId).catch(err => {
      console.error("FATAL: Background fulfillment failed to initialize:", err);
    });

    if (voucherId) {
      await redeemVoucher(voucherId);
    }
  }

  // 4. Return a 200 immediately to acknowledge receipt of the event
  res.json({ received: true });
  
};

/**
 * Handles GET /api/payment/pricecheck/:domain
 * Checks availability and returns the calculated price.
 */
exports.checkPriceAndAvailability = async (req, res) => {
  try {
    const domain = req.params.domain;
    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    console.log("checking domain", domain);
    const result = await checkDomainAndGetPrice(domain);

    console.log("result---------------,", result);
    if (result.available) {
      // Success: Return calculated price
      return res.status(200).json(result);
    } else {
      // Domain unavailable: Return status only
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error("Error in checkPriceAndAvailability:", error.message);
    console.log(error?.data?.error);
    res.status(500).json({ error: error.message || "Failed to check domain price." });
  }
};
