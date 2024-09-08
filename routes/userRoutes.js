const express = require('express');
const { upload } = require('../middlewares/uploadImageMiddleware');
const {
  getUser,
  getLoggedUserData,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deleteLoggedUserData,
  seenNotification,
  deleteNotification
} = require('../controllers/userController');
const { updateLoggedUserValidator } = require('../utils/validators/userValidator');

const authService = require('../services/authService');

const router = express.Router();

router.use(authService.protect);
router.use(authService.allowedTo("user"));

router.get('/get-me', getLoggedUserData, getUser);
router.put('/change-my-password', updateLoggedUserPassword);
router.put('/update-me', upload.single('avatar'), updateLoggedUserValidator, updateLoggedUserData);
router.delete('/delete-me', deleteLoggedUserData);
router.put("/seen-notification", seenNotification);
router.delete("/delete-notification", deleteNotification);

module.exports = router;
