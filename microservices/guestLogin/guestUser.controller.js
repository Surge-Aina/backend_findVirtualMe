const service = require("./guestUser.service");

exports.signupUser = async (req, res) => {
  try {
    const newUser = await service.createNewUser(req.body);
    res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(400).json({ messag: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { token, user } = await service.loginUser(req.body);
    res.status(200).json({ message: "logged in succesfully", token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.editUser = async (req, res) => {
  try {
    const userId = req.user.id; //auth middleware adds user
    const updatedInfo = req.body;

    const updatedUser = await service.updateUser({ userId, updatedInfo });

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Edit user error:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user.id; //auth middleware adds user
    const deletedUser = await service.deleteUser(userId);

    res.status(200).json({
      message: "User deleted successfully",
      user: deletedUser,
    });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(400).json({ message: err.message });
  }
};
