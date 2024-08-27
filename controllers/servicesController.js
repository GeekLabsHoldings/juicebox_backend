const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/cacheMiddleware')
const PaymentService = require('../services/paymentService');
const Service = require('../models/serviceModel');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError')

const buyService = catchError(asyncHandler (async (req, res) => {
  const { userId, serviceId, paymentMethodId, paymentType } = req.body;

  const service = await Service.findById(serviceId);
  const user = await User.findById(userId);

  if (!service || !user) {
    throw new ApiError('Service or User not found', 404);
  }

  let paymentIntent;
  if (paymentType === 'stripe') {
    paymentIntent = await PaymentService.createPaymentIntent(
      service.totalPrice,
      'usd',
      paymentMethodId,
      null,
      null
    );
  } else if (paymentType === 'visa') {
    if (!user.stripeCustomerId || !user.paymentMethod.token) {
      return res.status(400).send('No Stripe customer or payment method found for this user');
    }

    paymentIntent = await PaymentService.createPaymentIntent(
      service.totalPrice,
      'usd',
      null,
      user.stripeCustomerId,
      user.paymentMethod.token,
      true // off_session
    );
  } else {
    return res.status(400).send('Invalid payment type');
  }

  const payment = await PaymentService.createPaymentRecord(
    userId,
    serviceId,
    paymentIntent,
    paymentType,
    paymentMethodId
  );

  res.status(200).send({ success: true, payment });
}));

const saveAsDraft = catchError(asyncHandler (async (req, res) => {
  const { userId, serviceData } = req.body;

  const service = new Service({
    ...serviceData,
    userId,
    status: 'draft',
  });

  await service.save();

  res.status(200).send({ success: true, service });
}));

const linkCard = catchError(asyncHandler (async (req, res) => {
  const { userId, cardToken } = req.body;

  try {
    const customer = await PaymentService.linkCardToCustomer(userId, cardToken);
    res.status(200).send({ success: true, customer });
  } catch (error) {
    console.error('Error linking card:', error);
    res.status(500).send({ error: error.message });
  }
}));

module.exports = {
  buyService,
  saveAsDraft,
  linkCard,
};
