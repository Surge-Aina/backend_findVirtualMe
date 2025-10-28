const GuestUser = require("./guestUser.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.createNewUser = async (userData) => {
  try {
    const { name, username, portfolioType, phone, email, password } = userData;

    // Required fields check
    if (!portfolioType || !email || !password) {
      throw new Error("Portfolio type, email, and password are required");
    }

    // check if user already exists for this portfolio type
    const existingUser = await GuestUser.findOne({ email, portfolioType });
    if (existingUser) {
      throw new Error("A user with this email already exists for this portfolio type");
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create and save
    const newUser = new GuestUser({
      name,
      username,
      portfolioType,
      phone,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    return newUser;
  } catch (err) {
    console.error("Error creating new user:", err);
    throw err;
  }
};

exports.loginUser = async (userData) => {
  try {
    const { email, password, portfolioType } = userData;

    if (!email || !password || !portfolioType)
      throw new Error("Email, Password and portfolioType needed");

    //check if user exists
    const user = await GuestUser.findOne({ email, portfolioType });
    if (!user) throw new Error("User not found for this portfolio");

    //compare passwords
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error("Invalid credentials");

    //sign jwt token
    const token = jwt.sign({ id: user._id, portfolioType }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return { token, user };
  } catch (err) {
    console.log("error loggin in: ", err);
    throw err;
  }
};

exports.updateUser = async (userData) => {
  try {
    const { userId, updatedInfo } = userData;
    const user = await GuestUser.findByIdAndUpdate(userId, updatedInfo, { new: true });
    if (!user) throw new Error("User not found");
    return user;
  } catch (err) {
    console.error("Error updating user:", err);
    throw err;
  }
};

exports.deleteUser = async (id) => {
  try {
    const user = await GuestUser.findByIdAndDelete(id);
    if (!user) throw new Error("User not found");
    return user;
  } catch (err) {
    throw err;
  }
};
