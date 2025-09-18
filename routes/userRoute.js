const express = require('express');
const { loginUser, signupUser, addUser, getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', loginUser);
router.post('/signup', signupUser);

router.post('/addUser', addUser);//onboarding
router.get('/getAllUsers', getAllUsers);
router.get('/getUser/:id', getUserById);
router.patch('/updateUser/:id', updateUser);
router.delete('/deleteUser/:id', deleteUser);

router.get('/me', auth, (req, res) => {
    // Return all safe profile fields
    const {
        _id,
        username,
        email,
        firstName,
        lastName,
        phone,
        location,
    } = req.user;
    res.json({
        id: _id,
        username,
        email,
        firstName,
        lastName,
        phone,
        location,
    });
});

module.exports = router;