const subscritptions = require("../models/Subscriptions");

exports.getAllSubscriptions = async (req, res) => {
    try{
        const subList = await subscritptions.find();
        if (subList.length === 0) {
            return res.status(404).json({ message: 'No Subscriptions found' });
        }
        res.status(200).json(subList);
    }catch(error){
        console.log("error getting all subscriptions: ", error);
    }
}