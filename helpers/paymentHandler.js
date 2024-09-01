const Service = require("../models/serviceModel");

async function fulfillServicePurchase(paymentIntent) {
  // Logic to fulfill the service purchase
  const service = await Service.findOne({ stripePaymentIntentId: paymentIntent.id });

  if (service) {
    service.status = 'purchased';
    await service.save();
  }
}

async function handleFailedPayment(paymentIntent) {
  // Logic to handle failed payment
  const service = await Service.findOne({ stripePaymentIntentId: paymentIntent.id });

  if (service) {
    service.status = 'failed';
    await service.save();
  }
}

module.exports = {
  handleFailedPayment,
  fulfillServicePurchase,
}
