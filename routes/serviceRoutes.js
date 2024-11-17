const express = require("express");
const {
  purchaseService,
  initializeService,
  continueService,
  cancelService,
  linkCreditCard,
  validateDomain,
  callSales,
  getUserPurchasedServices,
  getService,
  scheduleCall,
  cancelPurchasedService,
  cancelSubscription,
} = require("../controllers/servicesController.js");
const upload = require('../middlewares/uploadMiddleware');
const {
  trackSuspiciousActivity,
} = require('../middlewares/botProtectionMiddleware');

const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect);
router.use(authService.allowedTo("user"));

router.use(trackSuspiciousActivity);

router.post("/initialize-service", upload, initializeService);
router.post("/:id/follow-up-service", continueService);
router.post("/cancel", cancelService);
router.post("/call-sales", callSales);
router.post('/link-card', linkCreditCard);
router.post('/purchase-service', purchaseService);
router.post("/validate-domain", validateDomain);
router.get("/get-purchased-services", getUserPurchasedServices);
router.get("/get-service/:id", getService);
router.post("/schedule-call", scheduleCall);
router.post("/cancel-purchased-service", cancelPurchasedService);
router.post("/cancel-subscription", cancelSubscription);

module.exports = router;
