const express = require("express");
const {
  signUpController,
  signInController,
  verifyEmailController,
  forgotPassword,
  resetPassword,
  verifyPassResetCode,
} = require("../controllers/authController.js");
const { signupValidator, loginValidator } = require('../utils/validators/authValidator.js')
const User = require("../models/userModel");

const router = express.Router();

router.post("/signup", signupValidator, signUpController);
router.post("/login", loginValidator, signInController);
router.get("/verify-email/:token", verifyEmailController);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyPassResetCode);
router.put("/reset-password", resetPassword);

router.post("/webhook/verify-email", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (user) {
    user.verifyEmail = true;
    await user.save();
    return res.status(200).json({ message: "Email verified!" });
  }

  res.status(404).json({ message: "User not found" });
});

module.exports = router;
