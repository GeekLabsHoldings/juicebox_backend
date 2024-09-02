const express = require("express");
const passport = require("passport");
const {
  signUpController,
  signInController,
  verifyEmailController,
  forgotPassword,
  resetPassword,
  verifyPassResetCode,
} = require("../controllers/authController.js");
const {
  signupValidator,
  loginValidator,
} = require("../utils/validators/authValidator.js");
const { verifyEmailWebhook } = require("../services/authService.js");
const createToken = require("../utils/createToken");

const router = express.Router();

router.post("/signup", signupValidator, signUpController);
router.post("/login", loginValidator, signInController);
router.get("/verify-email/:token", verifyEmailController);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyPassResetCode);
router.put("/reset-password", resetPassword);

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
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    try {
      const token = createToken(req.user._id);
      res.redirect(`/api/v1/auth/success?token=${token}`);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Authentication failed", error: err.message });
    }
  }
);

// Apple auth routes
router.get("/apple", passport.authenticate("apple"));

router.post(
  "/apple/callback",
  passport.authenticate("apple", { failureRedirect: "/login" }),
  (req, res) => {
    try {
      const token = createToken(req.user._id);
      res.redirect(`/api/v1/auth/success?token=${token}`);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Authentication failed", error: err.message });
    }
  }
);

// Success route
router.get("/success", (req, res) => {
  res.json({
    message: "User logged in successfully!",
    // password: "MyPassword$1",
    token: req.query.token,
    // user: req.user,
  });
});

// Logout route
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.json({ message: "Logged out successfully" });
  });
});

module.exports = router;
