const OnboardingUser = require("../models/onboardingUser");


exports.addUser = async (req, res) => {
    const { data } = req.body;
    try {
         if(!data){
            return res.status(400).json({message: 'Data not sent'});
        }
        const userObj = {
            firstName: data.userInfo.firstName,
            lastName: data.userInfo.lastName,
            email: data.userInfo.email,
            phone: data.userInfo.phone,
            location: data.userInfo.location,
            bio: data.userInfo.bio,
            goal: data.goal,
            industry: data.industry,
            experienceLevel: data.experience,
            skills: data.skills
        }
        const user = new OnboardingUser(userObj);
        await user.save();
        res.status(201).json({ user });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await OnboardingUser.find();
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getUserById = async (req, res) => {
  try {
    const user = await OnboardingUser.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.updateUser = async (req, res) => {
  try {
    const user = await OnboardingUser.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } //return updated user
    );
    if (!user) return res.status(404).json({  message: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const user = await OnboardingUser.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
