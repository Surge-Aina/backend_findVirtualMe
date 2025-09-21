const HandymanUser = require('../../models/handyMan/handymanUserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Function to create a signed JWT
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1d', // Token expires in 1 day
  });
};

// Register a new user
const registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await User.create({
      email,
      password: hashedPassword,
    });

    // Create token and send response
    const token = createToken(user._id);
    res.status(201).json({ token });

  } catch (error) {
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Log in an existing user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token and send response
    const token = createToken(user._id);
    res.status(200).json({ token });

  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = { registerUser, loginUser };