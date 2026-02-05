const User = require("../../../models/User");
const vercelService = require("../../../services/vercelService");
const namecheap = require("./namecheapProxy.service");
const { createDomainMapping } = require("../../DomainRouter/DomainRouter.service");

exports.handleFulfillment = async (domain, userId, paymentIntentId) => {
  try {
    // Purchase domain with Namecheap
    await namecheap.registerDomain({ domain });

    // Add domain to Vercel
    const vercelResult = await vercelService.addDomain(domain, userId);

    // Update user record with domain status
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          domains: {
            domain,
            status: vercelResult?.verified ? "active" : "pending_verification",
            registeredAt: new Date(),
            paymentIntentId,
          },
        },
      }
    );

    //Update DomainRouter.model records
    const user = await User.findById(userId);
    await createDomainMapping({
      domain: domain,
      user: user,
      portfolioId: null,
      notes:null,
    });

  } catch (err) {
    await User.updateOne(
      { _id: userId },
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

    console.error("Domain fulfillment error:", err);
  }
};
