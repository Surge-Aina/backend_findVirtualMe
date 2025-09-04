const User = require('../models/userModel.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Not using the signup feature for now
const signupUser = async(req, res) => {
    try {
        const {name, username, email, password } = req.body;
        if(!name || !username || !email || !password){
            return res.status(500).json({error: "name, username, email or password missing"});
        }

        // Can add checks with validator later to ensure email valid / password strong
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        // Hash password
        const hashed = await bcrypt.hash(password, 10);

        // Create and save new user
        const newUser = new User({ name, username, email, password: hashed });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ name, username, email, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const loginUser = async(req, res) => {
    try {
        const { email, password, portfolioId } = req.body;
        if (!email || !password || !portfolioId) return res.status(400).json({ message: 'All fields (including portfolioId) must be filled out'});

        const user = await User.findOne({ email, portfolioId });
        if (!user) return res.status(400).json({ message: 'User not found for this portfolio' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user._id, isAdmin: user.isAdmin, portfolioId: user.portfolioId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.status(201).json({ token, isAdmin: user.isAdmin, portfolioId: user.portfolioId });
    } catch (err) {
        console.log('error loggin in: ', err)
        res.status(500).json({ error: err.message });
    }
};

module.exports = { loginUser, signupUser };
