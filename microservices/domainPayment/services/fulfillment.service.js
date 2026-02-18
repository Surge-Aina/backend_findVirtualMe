const User = require("../../../models/User");
const vercelService = require("../../../services/vercelService");
const namecheap = require("./namecheapProxy.service");
const { createDomainMapping } = require("../../DomainRouter/DomainRouter.service");

exports.handleFulfillment = async (domain, userId, paymentIntentId) => {
  console.log(`Starting fulfillment for ${domain} (User: ${userId})`);

  try {
    //Don't process if this payment was already handled
    const existingUser = await User.findOne(
      { "domains.paymentIntentId": paymentIntentId },
      { _id: 1 }    
    );
    if (existingUser) {
      console.log(`Payment ${paymentIntentId} already processed. Skipping.`);
      return;
    }

    // Purchase Domain via Namecheap
    if (process.env.STRIPE_MODE === "live") {
      await namecheap.registerDomain({ domain });
      console.log(`Domain ${domain} successfully registered via Namecheap.`);
    } else {
      // Skip registration entirely in sandbox mode
      console.warn(`[SANDBOX] Skipping Namecheap registration for ${domain}`);
    }
    // Add to Vercel
    let vercelResult;
    try {
      vercelResult = await vercelService.addDomain(domain);
    } catch (vercelErr) {
      // If Namecheap succeeded but Vercel failed
      console.error("Namecheap succeeded, but Vercel addition failed:", vercelErr);
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            domains: {
              domain,
              status: "manual_intervention_required",
              failureReason: `Registered, but Vercel error: ${vercelErr.message}`,
              paymentIntentId,
              registeredAt: new Date(),
            },
          },
        }
      );
      return; //don't proceed to mapping if Vercel failed
    }

    //Update User & Create Mapping 
    await User.findOneAndUpdate(
      { _id: userId },
      {
        $push: {
          domains: {
            domain,
            status: vercelResult?.verified ? "active" : "pending_verification",
            verificationRecords: Array.isArray(vercelResult?.verification)
              ? vercelResult.verification.map(r => ({ type: r.type, name: r.name, value: r.value }))
              : [],
            registeredAt: new Date(),
            paymentIntentId,
          },
        },
      },
      { new: true }
    );
    console.log(`User ${userId} updated with domain ${domain}. Creating domain mapping...`);
    
    await createDomainMapping({
      domain,
      user: { _id: userId },
      portfolioId: null,
      notes: "Automatic fulfillment via Stripe Webhook",
    });
    console.log(`Domain mapping created for ${domain}. Fulfillment complete.`);

    console.log(`Fulfillment complete for ${domain}`);

  } catch (err) {
    console.error("Critical fulfillment error:", err);

    //Mark as failed if we haven't already handled it above
    await User.updateOne(
      { _id: userId, "domains.paymentIntentId": { $ne: paymentIntentId } },
      {
        $push: {
          domains: {
            domain,
            status: "failed_registration",
            failureReason: err.message,
            paymentIntentId,
          },
        },
      }
    );
  }
};