const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const Subscription = require("../models/Subscriptions");
const User = require("../models/Subscriptions");

const stripeSecretkey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;
const stripe = new Stripe(stripeSecretkey);

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  //verify that the call came from stripe
  let event;
  // Check if we are using stripe cli
  let stripeWHSEC;
  if (process.env.STRIPE_WEBHOOK_SECRET_CLI) {
    stripeWHSEC = process.env.STRIPE_WEBHOOK_SECRET_CLI;
  } else {
    stripeWHSEC =
      process.env.STRIPE_MODE === "live"
        ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
        : process.env.STRIPE_WEBHOOK_SECRET_TEST;
  }
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWHSEC);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      //new subscription created or updated old one
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;

        // Fetch customer details to get email and name
        const customer = await stripe.customers.retrieve(subscription.customer);

        // Map subscription items
        const subscriptionItems =
          subscription.items?.data?.map((item) => ({
            itemId: item.id,
            priceId: item.price.id,
            quantity: item.quantity,
            active: true,
          })) || [];

        // Determine subscription type from price ID
        const primaryPriceId = subscription.items?.data?.[0]?.price?.id;
        let subscriptionType = "unknown";
        if (primaryPriceId === "price_1S32zY4RRTaBgmEqhHSUxiMT") {
          subscriptionType = "basic";
        } else if (primaryPriceId === "price_1S32yN4RRTaBgmEqVX7uegSs") {
          subscriptionType = "pro";
        }

        const updateData = {
          email: customer.email,
          name: customer.name,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          status: subscription.status,
          subscriptionType: subscriptionType,
          priceId: primaryPriceId,
          subscriptionItems: subscriptionItems,
          currentPeriodStart: subscription.created
            ? new Date(subscription.created * 1000)
            : null,
          currentPeriodEnd: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000)
            : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
          defaultPaymentMethodId: subscription.default_payment_method,
          $push: {
            modificationLogs: {
              subscriptionType: subscriptionType,
              status: subscription.status,
              priceId: primaryPriceId,
              action:
                event.type === "customer.subscription.created" ? "created" : "updated",
              metadata: {
                itemsCount: subscriptionItems.length,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              },
            },
          },
        };

        // Handle cancellation fields
        if (subscription.canceled_at) {
          updateData.canceledAt = new Date(subscription.canceled_at * 1000);
        }

        await Subscription.findOneAndUpdate(
          { customerId: subscription.customer },
          updateData,
          { upsert: true, new: true } //upsert: if no sub exists create one, new: return updated sub
        );

        console.log(
          `Subscription ${event.type} processed for customer ${subscription.customer} - Status: ${subscription.status}`
        );
        break;
      }

      //subscription cancelled
      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        // Fetch customer details
        const customer = await stripe.customers.retrieve(subscription.customer);

        // Map subscription items
        const subscriptionItems =
          subscription.items?.data?.map((item) => ({
            itemId: item.id,
            priceId: item.price.id,
            quantity: item.quantity,
            active: false, // Mark as inactive since subscription is canceled
          })) || [];

        // Determine subscription type from price ID
        const primaryPriceId = subscription.items?.data?.[0]?.price?.id;
        let subscriptionType = "unknown";
        if (primaryPriceId === "price_1S32zY4RRTaBgmEqhHSUxiMT") {
          subscriptionType = "basic";
        } else if (primaryPriceId === "price_1S32yN4RRTaBgmEqVX7uegSs") {
          subscriptionType = "pro";
        }

        await Subscription.findOneAndUpdate(
          { customerId: subscription.customer },
          {
            email: customer.email,
            name: customer.name,
            customerId: subscription.customer,
            status: "canceled",
            subscriptionType: subscriptionType,
            priceId: primaryPriceId,
            subscriptionItems: subscriptionItems,
            currentPeriodStart: subscription.current_period_start
              ? new Date(subscription.current_period_start * 1000)
              : null,
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : null,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : new Date(),
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
            defaultPaymentMethodId: subscription.default_payment_method,
            $push: {
              modificationLogs: {
                subscriptionType: subscriptionType,
                status: "canceled",
                priceId: primaryPriceId,
                action: "canceled",
                metadata: {
                  cancelReason: subscription.cancellation_details?.reason || "unknown",
                  itemsCount: subscriptionItems.length,
                  canceledAt: subscription.canceled_at,
                  currentPeriodEnd: subscription.current_period_end,
                },
              },
            },
          }
        );

        console.log(
          `Subscription canceled for customer ${subscription.customer} - Email: ${
            customer.email
          } - Period ends: ${
            subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
              : "N/A"
          }`
        );
        break;
      }

      // Handle subscription paused
      case "customer.subscription.paused": {
        const subscription = event.data.object;

        await Subscription.findOneAndUpdate(
          { customerId: subscription.customer },
          {
            status: "paused",
            $push: {
              modificationLogs: {
                subscriptionType: subscription.items?.data?.[0]?.price?.id,
                status: "paused",
                action: "paused",
              },
            },
          }
        );

        console.log(`Subscription paused for customer ${subscription.customer}`);
        break;
      }
      // Handle subscription resumed
      case "customer.subscription.resumed": {
        const subscription = event.data.object;

        await Subscription.findOneAndUpdate(
          { customerId: subscription.customer },
          {
            status: subscription.status,
            $push: {
              modificationLogs: {
                subscriptionType: subscription.items?.data?.[0]?.price?.id,
                status: subscription.status,
                action: "resumed",
              },
            },
          }
        );

        console.log(`Subscription resumed for customer ${subscription.customer}`);
        break;
      }

      //payment logs with charge ID for refunds
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        // Only log subscription payments
        if (
          paymentIntent.customer &&
          paymentIntent.description?.includes("Subscription")
        ) {
          const chargeId = paymentIntent.latest_charge;

          //get subscription info from customer
          const subscriptions = await stripe.subscriptions.list({
            customer: paymentIntent.customer,
            status: "active",
            limit: 1,
          });

          const subscriptionType =
            subscriptions.data[0]?.items?.data?.[0]?.price?.id || "unknown";

          await Subscription.findOneAndUpdate(
            { customerId: paymentIntent.customer },
            {
              $push: {
                paymentLog: {
                  paymentIntentId: paymentIntent.id,
                  chargeId: chargeId, // Charge ID for refunds
                  invoiceId: null,
                  amount: paymentIntent.amount,
                  currency: paymentIntent.currency,
                  confirmed: true,
                  subscriptionType: subscriptionType,
                  timestamp: new Date(paymentIntent.created * 1000),
                },
              },
            }
          );

          console.log(
            `Payment intent succeeded: ${
              paymentIntent.id
            } with charge: ${chargeId} for customer ${paymentIntent.customer} - Amount: ${
              paymentIntent.amount / 100
            } ${paymentIntent.currency}`
          );
        }
        break;
      }

      //payment logs
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        // Update subscription status if past_due
        await Subscription.findOneAndUpdate(
          { customerId: invoice.customer },
          {
            status: "active", // Reset to active after successful payment
            latestInvoiceId: invoice.id,
          }
        );

        console.log(
          `Invoice payment succeeded for ${invoice.customer} - Amount: ${
            invoice.amount_paid / 100
          } ${invoice.currency}`
        );
        break;
      }

      //log payment failed
      case "invoice.payment_failed": {
        const invoice = event.data.object;

        await Subscription.findOneAndUpdate(
          { customerId: invoice.customer },
          {
            status: "past_due",
            latestInvoiceId: invoice.id,
            $push: {
              modificationLogs: {
                subscriptionType: invoice.lines?.data?.[0]?.price?.id,
                status: "past_due",
                action: "payment_failed",
                metadata: {
                  invoiceId: invoice.id,
                  attemptCount: invoice.attempt_count,
                },
              },
              paymentLog: {
                paymentIntentId: invoice.payment_intent,
                invoiceId: invoice.id,
                amount: invoice.amount_due,
                currency: invoice.currency,
                confirmed: false,
                subscriptionType: invoice.lines?.data?.[0]?.price?.id,
              },
            },
          }
        );

        console.log(
          `Invoice payment failed for ${invoice.customer} - Attempt: ${invoice.attempt_count}`
        );
        break;
      }

      // Handle trial ending
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object;

        await Subscription.findOneAndUpdate(
          { customerId: subscription.customer }, // ← Search by customerId
          {
            $push: {
              modificationLogs: {
                subscriptionType: subscription.items?.data?.[0]?.price?.id,
                status: subscription.status,
                action: "trial_ending",
                metadata: {
                  trialEnd: new Date(subscription.trial_end * 1000),
                },
              },
            },
          }
        );

        console.log(`Trial ending for customer ${subscription.customer}`);
        break;
      }

      // Handle incomplete subscriptions
      case "invoice.payment_action_required": {
        const invoice = event.data.object;

        await Subscription.findOneAndUpdate(
          { customerId: invoice.customer },
          {
            status: "incomplete",
            $push: {
              modificationLogs: {
                status: "incomplete",
                action: "payment_action_required",
                metadata: {
                  invoiceId: invoice.id,
                },
              },
            },
          }
        );

        console.log(`Payment action required for customer ${invoice.customer}`);
        break;
      }

      //refunds, also logs if issued from dashboard
      case "charge.refunded": {
        const charge = event.data.object;
        const latestRefund = charge.refunds.data[0]; // Most recent refund

        // Check if we already logged this refund
        const existing = await Subscription.findOne({
          customerId: charge.customer,
          "refundLog.refundId": latestRefund.id,
        });

        if (!existing) {
          // This refund wasn't logged (came from Dashboard)
          await Subscription.findOneAndUpdate(
            { customerId: charge.customer },
            {
              $push: {
                refundLog: {
                  refundId: latestRefund.id,
                  chargeId: charge.id,
                  amount: latestRefund.amount,
                  currency: latestRefund.currency,
                  reason: latestRefund.reason,
                  status: latestRefund.status,
                  source: "dashboard",
                },
              },
            }
          );
        }
        break;
      }

      //save stripe subscription id after user finishes checking out
      case "checkout.session.completed": {
        const session = event.data.object;
        const stripeSubscriptionId = session.subscription;
        const customerId = session.customer;

        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { stripeSubscriptionId }
        );
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
