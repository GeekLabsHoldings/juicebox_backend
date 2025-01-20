const express = require("express");
const {
  signUpController,
  signInController,
  verifyEmailController,
  forgotPassword,
  resetPassword,
  verifyPassResetCode,
  googleLogin,
  logoutController,
} = require("../controllers/authController.js");
const passport = require("passport");
const {
  signupValidator,
  loginValidator,
} = require("../utils/validators/authValidator.js");
const { verifyEmailWebhook } = require("../services/authService.js");
const createToken = require("../utils/createToken");
const validatorMiddleware = require('../middlewares/validationMiddleware.js');

const router = express.Router();

router.post("/signup", validatorMiddleware, signupValidator, signUpController);
router.post("/login", loginValidator, signInController);
router.post("/logout", logoutController);
router.get("/verify-email/:token", verifyEmailController);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyPassResetCode);
router.put("/reset-password", resetPassword);

router.post("/with-google", validatorMiddleware, googleLogin);

router.post("/webhook/verify-email", verifyEmailWebhook);

// Google auth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.BASE_CLIENT_URL}/login`,
  }), // Redirect to the login page on failure
  (req, res) => {
    // Successful authentication, redirect to the frontend app
    res.redirect(`${process.env.BASE_CLIENT_URL}`); // Replace with your frontend URL
  }
);

router.get("/logout", (req, res) => {
  req.logout();
  res.redirect(`${process.env.BASE_CLIENT_URL}`);
});

router.get("/user", (req, res) => {
  if (req.user) {
    // Create token
    const token = createToken(req.user);
    res.status(200).json({ message: "Login successful", token });
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
});

module.exports = router;
