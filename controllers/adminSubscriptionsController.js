const req = require("express/lib/request");
const Subscriptions = require("../models/Subscriptions");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.getAllSubscriptions = async (req, res) => {
    try{
        const subList = await Subscriptions.find();
        if (subList.length === 0) {
            return res.status(404).json({ message: 'No Subscriptions found' });
        }
        res.status(200).json(subList);
    }catch(error){
        console.log("error getting all subscriptions: ", error);
    }
}


const PRICE_MAP = {
  basic: "price_1S32zY4RRTaBgmEqhHSUxiMT",   // $9/month
  pro: "price_1S32yN4RRTaBgmEqVX7uegSs",     // $29/month
};

exports.updateSubscription = async (req, res) => {
  try {
    const { subscriptionId, newPlan } = req.body;

    // Update on Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id, // existing subscription item
          price: PRICE_MAP[newPlan], // new price/plan
        },
      ],
      proration_behavior: "create_prorations", // apply prorated charges
    });

    // Update in MongoDB
    const dbSubscription = await Subscriptions.findOneAndUpdate(
      { subscriptionId },
      {
        subscriptionType: newPlan,
        $push: {
          modificationLogs: {
            subscriptionType: PRICE_MAP[newPlan],
            status: updatedSubscription.status,
          },
        },
      },
      { new: true } 
    );

    res.json({
        success: true,
        stripeSubscription: updatedSubscription,  
        dbSubscription: dbSubscription             
    });
  } catch (err) {
    console.error("Error updating subscription:", err);
    res.status(500).json({ error: err.message });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,   // let user keep until end of billing cycle
    });

    // Update MongoDB
    const dbSubscription = await Subscriptions.findOneAndUpdate(
      { subscriptionId },
      {
        status: canceledSubscription.status,
        $push: {
          modificationLogs: {
            subscriptionType: canceledSubscription.items.data[0].price.id,
            status: canceledSubscription.status,
          },
        },
      },
      { new: true }
    );

    res.json({
        success: true,
        stripeSubscription: canceledSubscription,  
        dbSubscription: dbSubscription             
    });
  } catch (err) {
    console.error("Error canceling subscription:", err);
    res.status(500).json({ error: err.message });
  }
};
