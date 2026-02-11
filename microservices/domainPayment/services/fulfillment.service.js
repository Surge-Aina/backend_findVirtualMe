const User = require("../../../models/User");
const vercelService = require("../../../services/vercelService");
const namecheap = require("./namecheapProxy.service");
const { createDomainMapping } = require("../../DomainRouter/DomainRouter.service");

exports.handleFulfillment = async (domain, userId, paymentIntentId) => {
  console.log(`Starting fulfillment for ${domain} (User: ${userId})`);

  try {
    //Don't process if this payment was already handled
    const existingUser = await User.findOne({ "domains.paymentIntentId": paymentIntentId });
    if (existingUser) {
      console.log(`Payment ${paymentIntentId} already processed. Skipping.`);
      return;
    }

    // Purchase Domain via Namecheap
    await namecheap.registerDomain({ domain });
    console.log(`Domain ${domain} successfully registered via Namecheap.`);

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
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      {
        $push: {
          domains: {
            domain,
            status: vercelResult?.verified ? "active" : "pending_verification",
            verificationRecords: vercelResult?.verification || [],
            registeredAt: new Date(),
            paymentIntentId,
          },
        },
      },
      { new: true }
    );

    await createDomainMapping({
      domain,
      user: updatedUser,
      portfolioId: null,
      notes: "Automatic fulfillment via Stripe Webhook",
    });

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