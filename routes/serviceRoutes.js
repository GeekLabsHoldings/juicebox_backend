const express = require("express");
const {
  buyService,
  saveAsDraft,
  linkCard,
} = require("../controllers/servicesController.js");

const authService = require('../services/authService');

const { paymentWebhook } = require('../services//paymentService');

const router = express.Router();

router.use(authService.protect);

router.use(authService.allowedTo('user'));

router.post('/purchase', buyService);
router.post('/save-draft', saveAsDraft);
router.post('/link-card', linkCard);

router.post('/webhook', express.raw({ type: 'application/json' }), paymentWebhook);

module.exports = router;
