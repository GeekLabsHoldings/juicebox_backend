const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const Service = require('../models/serviceModel');
const User = require('../models/userModel');
const Payment = require('../models/paymentModel');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const checkDomainExists = require('../services/domainService');
const stripe = require('../config/stripe');
const { retrieveBalance } = require('../helpers/retriveBalance');
const handleError = require('../helpers/handleError');

// Save a new service as in-progress
exports.inProgressService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceData } = req.body;
    const { options } = serviceData;
    const totalSteps = serviceData.totalSteps || 1;
    let currentStep = options.length;

    currentStep = currentStep >= totalSteps ? totalSteps : currentStep;
    serviceData.status =
      currentStep >= totalSteps ? 'completed' : 'in-progress';

    const service = new Service({
      ...serviceData,
      userId: req.user._id,
      serviceId: serviceData._id,
      status: serviceData.status,
      totalSteps,
      currentStep,
    });

    await service.save();

    res.status(201).json(new ApiResponse(201, service, 'Service created'));
  }),
);

// Continue service with new options
exports.continueService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId, updates } = req.body;
    const service = await Service.findById(serviceId);

    if (!service) throw new ApiError('Service not found', 404);
    if (service.currentStep >= service.totalSteps)
      return res
        .status(400)
        .send({ success: false, message: 'Service is already completed.' });

    const remainingSteps = service.totalSteps - service.options.length;
    if (updates.options?.length > remainingSteps)
      updates.options = updates.options.slice(0, remainingSteps);

    service.options = [...service.options, ...updates.options];
    service.currentStep = Math.min(service.options.length, service.totalSteps);

    service.status =
      service.currentStep >= service.totalSteps ? 'completed' : 'in-progress';
    await service.save();

    res.status(200).json(new ApiResponse(200, service, 'Service updated'));
  }),
);

// Call sales
exports.callSales = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId } = req.body;

    // Find the service by ID
    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError('Service not found', 404);
    }

    // Ensure the service is completed
    if (service.status !== 'completed') {
      throw new ApiError('Service is not completed', 400);
    }

    // Fetch the user associated with the service
    const user = await User.findById(service.userId);

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    // Check if the user has a phone number
    if (!user.phoneNumber) {
      throw new ApiError('Please add your phone number first.', 400);
    }

    // Update the service status to "call-sales"
    service.status = 'call-sales';

    await service.save();

    res
      .status(200)
      .json(new ApiResponse(200, service, 'Service updated to call-sales'));
  }),
);

// Cancel a service
exports.cancelService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId } = req.body;

    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError('Service not found', 404);
    }

    if (service.status === 'purchased') {
      throw new ApiError('Cannot cancel a purchased service', 400);
    }

    await Service.findByIdAndDelete(serviceId);

    res
      .status(200)
      .json(new ApiResponse(200, null, 'Service canceled successfully'));
  }),
);

// Link a credit card
exports.linkCreditCard = catchError(
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) throw new ApiError('User not found', 404);

    const { paymentMethodId } = req.body;
    if (!paymentMethodId)
      throw new ApiError('Payment method ID is required', 400);

    try {
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: user.stripeCustomerId,
        },
      );

      const { availableBalance, currency } = await retrieveBalance();
      user.linkedCards.push({ stripeCardId: paymentMethod.id });
      user.balance = availableBalance;
      user.currency = currency;

      await user.save();

      res
        .status(200)
        .json(new ApiResponse(200, user, 'Card linked successfully'));
    } catch (error) {
      return handleError(error, res, 'Error linking card');
    }
  }),
);

// Purchase a service
exports.purchaseService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId, paymentMethodId } = req.body;

    if (!serviceId || !paymentMethodId)
      throw new ApiError('Service ID and payment method ID are required', 400);

    const service = await Service.findById(serviceId);
    if (!service || service.status !== 'completed')
      throw new ApiError('Invalid service status', 400);

    const user = req.user;
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      const { availableBalance, currency } = await retrieveBalance();
      user.balance = availableBalance;
      user.currency = currency;
      await user.save();
    }

    if (user.balance < service.totalPrice)
      return res.status(400).json({ message: 'Insufficient balance' });

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(service.totalPrice * 100),
        currency: 'usd',
        payment_method: paymentMethodId,
        customer: customerId,
        confirm: true,
      });

      const payment = new Payment({
        userId: user._id,
        serviceId: service._id,
        amount: service.totalPrice,
        status: 'pending',
      });
      await payment.save();

      service.paymentStatus = 'paid';
      await service.save();

      res
        .status(200)
        .json(new ApiResponse(200, paymentIntent, 'Payment successful'));
    } catch (error) {
      return handleError(error, res, 'Error processing payment');
    }
  }),
);

// Validate domain
exports.validateDomain = catchError(
  asyncHandler(async (req, res) => {
    const { domain } = req.body;

    if (!domain) {
      throw new ApiError('Domain is required', 400);
    }

    try {
      const result = await checkDomainExists(domain);

      if (result.available) {
        res.status(200).json(new ApiResponse(200, result, 'Domain available'));
      } else {
        res.status(400).json(new ApiResponse(400, result, 'Domain not available'));
      }
    } catch (error) {
      if (error.message.startsWith('The TLD')) {
        res.status(400).send({ success: false, message: error.message });
      } else {
        console.error('Error checking domain availability:', error);
        throw new ApiError('Error checking domain availability', 500);
      }
    }
  }),
);
