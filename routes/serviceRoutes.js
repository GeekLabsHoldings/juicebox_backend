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
  // createPaymentMethod,
} = require("../controllers/servicesController.js");
const upload = require('../middlewares/uploadMiddleware');

const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect);

router.use(authService.allowedTo("user"));

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

// Route for successful payment
router.get('/api/v1/services/:serviceId/success', (req, res) => {
  const paymentIntentId = req.query.paymentIntentId;
  // Fetch payment intent details from Stripe if necessary
  res.status(200).json({
    status: 'success',
    message: 'Payment succeeded',
    paymentIntentId,
  });
});

module.exports = router;
