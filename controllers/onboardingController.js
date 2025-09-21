// //const OnboardingUser = require("../models/onboardingUser");
// const UserModel = reqire("../models/userModel"); //this will be the main and only model moving forward
// const bcrypt = require('bcryptjs');
// const User = require('../models/User'); // main user model

// exports.addUser = async(req, res) => {
//     const { data } = req.body;
//     try {
//         if (!data) {
//             return res.status(400).json({ message: 'Data not sent' });
//         }
//         const email = data.userInfo.email;
//         if (!email) {
//             return res.status(400).json({ message: 'Email is required' });
//         }
//         //const username = (data.userInfo.username && data.userInfo.username.trim()) || email.split('@')[0];
//         const username = data.userInfo.username;
//         if (!username) {
//             return res.status(400).json({ message: 'Username is required' });
//         }

//         const hashedPassword = await bcrypt.hash(data.userInfo.password, 10);

//         const userObj = {
//             firstName: data.userInfo.firstName,
//             lastName: data.userInfo.lastName,
//             username: username,
//             email: data.userInfo.email,
//             phone: data.userInfo.phone,
//             location: data.userInfo.location,
//             bio: data.userInfo.bio,
//             password: hashedPassword,
//             goal: data.goal,
//             industry: data.industry,
//             experienceLevel: data.experience,
//             skills: data.skills
//         }

//         let onboardingUser;
//         try {
//             onboardingUser = new OnboardingUser(userObj);
//             await onboardingUser.save();
//         } catch (error) {
//             if (error.code === 11000) {
//                 return res.status(400).json({ message: 'Email or username already exists (onboarding)' });
//             }
//             throw error;
//         }


        
//         // const mainUser = new User({
//         //     firstName: data.userInfo.firstName,
//         //     lastName: data.userInfo.lastName,
//         //     username: username,
//         //     email: data.userInfo.email,
//         //     password: hashedPassword,
//         //     role: 'customer'
//         // });
//         // try {
//         //     await mainUser.save();
//         // } catch (error) {
//         //     if (error.code === 11000) {
//         //         return res.status(400).json({ message: 'Email or username already exists (main)' });
//         //     }
//         //     throw error;
//         // }

//         res.status(201).json({ user: onboardingUser });
//     } catch (error) {
//         console.error("AddUser error:", error);
//         res.status(400).json({ message: error.message });
//     }
// };


// exports.getAllUsers = async(req, res) => {
//     try {
//         const users = await UserModel.find();
//         res.status(200).json({ users });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };


// exports.getUserById = async(req, res) => {
//     try {
//         const user = await UserModel.findById(req.params.id);
//         if (!user) return res.status(404).json({ message: "User not found" });
//         res.status(200).json({ user });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };


// exports.updateUser = async(req, res) => {
//     try {
//         const user = await OnboardingUser.findByIdAndUpdate(
//             req.params.id,
//             req.body, { new: true }
//         );
//         if (!user) return res.status(404).json({ message: "User not found" });
//         res.status(200).json({ user });
//     } catch (error) {
//         res.status(400).json({ message: error.message });
//     }
// };


// exports.deleteUser = async(req, res) => {
//     try {
//         const user = await OnboardingUser.findByIdAndDelete(req.params.id);
//         if (!user) return res.status(404).json({ message: "User not found" });
//         res.status(200).json({ message: "User deleted successfully" });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };