const express = require("express");
const {
  purchaseService,
  initializeService,
  continueService,
  cancelService,
  linkCreditCard,
  validateDomain,
  callSales,
} = require("../controllers/servicesController.js");

const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect);

router.use(authService.allowedTo("user"));

router.post("/initialize-service", initializeService);
router.post("/:id/follow-up-service", continueService);
router.post("/cancel", cancelService);
router.post("/call-sales", callSales);
router.post('/link-card', linkCreditCard);
router.post('/purchase-service', purchaseService);
router.post("/validate-domain", validateDomain);

module.exports = router;
