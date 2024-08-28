const express = require('express');
const { upload } = require('../middlewares/uploadImageMiddleware');
const {
  getUser,
  getLoggedUserData,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deleteLoggedUserData,
} = require('../controllers/userController');
const { updateLoggedUserValidator } = require('../utils/validators/userValidator');

const authService = require('../services/authService');

const router = express.Router();

router.use(authService.protect);

router.get('/getMe', getLoggedUserData, getUser);
router.put('/changeMyPassword', updateLoggedUserPassword);
router.put('/updateMe', upload.single('avatar'), updateLoggedUserValidator, updateLoggedUserData);
router.delete('/deleteMe', deleteLoggedUserData);

module.exports = router;
