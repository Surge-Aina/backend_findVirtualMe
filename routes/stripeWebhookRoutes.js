const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const Subscription = require("../models/Subscriptions");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  //verify that the call came from stripe
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).json({message: `Webhook Error: ${err.message}`});
  }

  try {
      switch (event.type) {
        //new subscription created or updated old one
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object;

          await Subscription.findOneAndUpdate(
            { subscriptionId: subscription.id },
            {
              customerId: subscription.customer,
              subscriptionId: subscription.id,
              status: subscription.status,
              subscriptionType: subscription.items?.data?.[0]?.price?.id,
              priceId: subscription.items?.data?.[0]?.price?.id,
              $push: {
                modificationLogs: {
                  subscriptionType: subscription.items?.data?.[0]?.price?.id,
                  status: subscription.status,
                },
              },
            },
            { upsert: true, new: true }
          );

          console.log(
            `Subscription ${event.type} processed for customer ${subscription.customer}`
          );
          break;
        }

        //subscription cancelled
        case "customer.subscription.deleted": {
          const subscription = event.data.object;

          await Subscription.findOneAndUpdate(
            { subscriptionId: subscription.id },
            {
              status: "canceled",
              $push: {
                modificationLogs: {
                  subscriptionType: subscription.items?.data?.[0]?.price?.id,
                  status: "canceled",
                },
              },
            }
          );

          console.log(
            `Subscription canceled for customer ${subscription.customer}`
          );
          break;
        }

        //payment logs
        case "invoice.payment_succeeded":
        case "invoice_payment.paid":  // legacy event name
        {
          const invoice = event.data.object;

          for (const line of invoice.lines?.data || []) {
            await Subscription.findOneAndUpdate(
              { customerId: invoice.customer },
              {
                latestInvoiceId: invoice.id,
                $push: {
                  paymentLog: {
                    paymentIntentId: invoice.payment_intent,
                    amount: line.amount,
                    currency: invoice.currency,
                    confirmed: true,
                    subscriptionType: line.price?.id,
                  },
                },
              }
            );
          }

          console.log(`Invoice payment succeeded for ${invoice.customer}`);
          break;
        }

        //log payment failed
        case "invoice.payment_failed": {
          const invoice = event.data.object;

          await Subscription.findOneAndUpdate(
            { customerId: invoice.customer },
            {
              status: "past_due",
              $push: {
                modificationLogs: {
                  subscriptionType: invoice.lines?.data?.[0]?.price?.id,
                  status: "past_due",
                },
              },
            }
          );

          console.log(`Invoice payment failed for ${invoice.customer}`);
          break;
        }

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Error handling webhook:", err);
      res.status(500).json({ message: "Webhook handler error" });
    }
});

module.exports = router;
