const express = require('express');

const {
  getUser,
  getLoggedUserData,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deleteLoggedUserData,
} = require('../controllers/userController');

const authService = require('../services/authService');

const router = express.Router();

router.use(authService.protect);

router.get('/getMe', getLoggedUserData, getUser);
router.put('/changeMyPassword', updateLoggedUserPassword);
router.put('/updateMe', updateLoggedUserData);
router.delete('/deleteMe', deleteLoggedUserData);

module.exports = router;
