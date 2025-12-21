const User = require("../../../models/User");
const vercelService = require("../../../services/vercelService");
const namecheap = require("./namecheapProxy.service");

exports.handleFulfillment = async (domain, userId, paymentIntentId) => {
  try {
    await namecheap.registerDomain({ domain });

    const vercelResult = await vercelService.addDomain(domain, userId);

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

    throw err;
  }
};
