const express = require("express");
const {
  buyService,
  inProgressService,
  continueService,
  cancelService,
  linkCard,
  validateDomain,
} = require("../controllers/servicesController.js");

const authService = require("../services/authService");

const { paymentWebhook } = require("../services//paymentService");

const router = express.Router();

router.use(authService.protect);

router.use(authService.allowedTo("user"));

router.post("/purchase", buyService);
router.post("/in-progress", inProgressService);
router.post("/continue", continueService);
router.post("/cancel", cancelService);
router.post("/link-card", linkCard);
router.post("/validate-domain", validateDomain);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentWebhook
);

module.exports = router;
