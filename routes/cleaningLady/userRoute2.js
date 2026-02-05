const express = require('express');
const { loginUser, signupUser } = require('../../controllers/cleaningLady/userController2');

const router = express.Router();

router.post('/login', loginUser);
//router.post('/signup', signupUser);

 module.exports = router;