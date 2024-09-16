const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const Service = require('../models/serviceModel');
const User = require('../models/userModel');
const Payment = require('../models/paymentModel');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const checkDomainExists = require('../services/domainService');
const { handleStripeError } = require('../helpers/stripeErrorHandler');
const {
  attachPaymentMethod,
  createPaymentIntent,
} = require('../services/paymentService');
const {
  updateUserBalance,
  checkBalance,
  updateBalanceInUserModel,
} = require('../services/balanceService');
const { withTransaction } = require('../helpers/transactionHelper');

// Save a new service as in-progress
exports.initializeService = catchError(
  asyncHandler(async (req, res) => {
    const { type, options, totalSteps } = req.body;
    const currentStep = options.length;
    const steps = totalSteps || 1;
    const status = currentStep >= steps ? 'completed' : 'in-progress';

    let service;

    await withTransaction(async (session) => {
      // Map the file URLs to their respective options dynamically
      const processedOptions = options.map((option, index) => {
        const file = req.files.find(file => file.fieldname === `fileUrl_${index}`);
        if (file) {
          option.fileUrl = file.location;
        }
        return option;
      });

      service = new Service({
        type,
        options: processedOptions,
        userId: req.user._id,
        status,
        totalSteps: steps,
        currentStep: currentStep >= steps ? steps : currentStep,
      });

      await service.save({ session });
    });

    res.status(201).json(new ApiResponse(201, service, 'Service created'));
  }),
);

// Continue service with new options
exports.continueService = catchError(
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    let service;

    await withTransaction(async (session) => {
      service = await Service.findById(id).session(session);

      if (!service) throw new ApiError('Service not found', 404);
      if (service.currentStep >= service.totalSteps)
        throw new ApiError('Service is already completed.', 400);

      const remainingSteps = service.totalSteps - service.options.length;
      if (updates.options?.length > remainingSteps)
        updates.options = updates.options.slice(0, remainingSteps);

      service.options = [...service.options, ...updates.options];
      service.currentStep = Math.min(
        service.options.length,
        service.totalSteps,
      );
      service.status =
        service.currentStep >= service.totalSteps ? 'completed' : 'in-progress';

      await service.save({ session });
    });

    res.status(200).json(new ApiResponse(200, service, 'Service updated'));
  }),
);

// Call sales
exports.callSales = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId } = req.body;
    let service;

    await withTransaction(async (session) => {
      service = await Service.findById(serviceId).session(session);
      if (!service) throw new ApiError('Service not found', 404);
      if (service.status !== 'completed')
        throw new ApiError('Service is not completed', 400);

      const user = await User.findById(service.userId).session(session);
      if (!user) throw new ApiError('User not found', 404);
      if (!user.phoneNumber)
        throw new ApiError('Please add your phone number first.', 400);

      service.status = 'call-sales';
      await service.save({ session });
    });

    res
      .status(200)
      .json(new ApiResponse(200, service, 'Service updated to call-sales'));
  }),
);

// Cancel a service
exports.cancelService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId } = req.body;
    let service;

    await withTransaction(async (session) => {
      service = await Service.findById(serviceId).session(session);
      if (!service) throw new ApiError('Service not found', 404);
      if (service.status === 'purchased')
        throw new ApiError('Cannot cancel a purchased service', 400);

      await Service.findByIdAndDelete(serviceId).session(session);
    });

    res
      .status(200)
      .json(new ApiResponse(200, service, 'Service canceled successfully'));
  }),
);

// Link a credit card
exports.linkCreditCard = catchError(
  asyncHandler(async (req, res) => {
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) throw new ApiError('Payment method ID is required', 400);

    let user;

    await withTransaction(async (session) => {
      user = await User.findById(req.user._id)
        .select('stripeCustomerId linkedCards balance currency')
        .session(session);
      if (!user) throw new ApiError('User not found', 404);

      const paymentMethod = await attachPaymentMethod(user, paymentMethodId);

      // Update user balance using the utility function
      await updateBalanceInUserModel(user);

      user.linkedCards.push({ stripeCardId: paymentMethod.id });
      await user.save({ session });
    })
      .then(() => {
        res.status(200).json(new ApiResponse(200, user.linkCreditCard, 'Card linked successfully'));
      })
      .catch((error) => {
        const { status, message, details } = handleStripeError(error);
        res.status(status).json({ message, error: details });
      });
  })
);

// Purchase a service
exports.purchaseService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId, paymentMethodId } = req.body;
    if (!serviceId || !paymentMethodId) throw new ApiError('Service ID and payment method ID are required', 400);

    let paymentIntent;

    await withTransaction(async (session) => {
      // Fetch service and user data in parallel
      const [service, user] = await Promise.all([
        Service.findById(serviceId).select('totalPrice paymentStatus status').session(session),
        User.findById(req.user._id).select('stripeCustomerId balance currency').session(session),
      ]);

      if (!service) throw new ApiError('Service not found', 404);
      if (service.status !== 'completed') throw new ApiError('Only completed services can be purchased', 400);
      if (service.paymentStatus === 'paid') throw new ApiError('Service is already paid', 400);

      // Update user balance using the utility function
      await updateBalanceInUserModel(user);

      // Check if user has sufficient balance
      if (!checkBalance(user, service.totalPrice)) {
        throw new ApiError('Insufficient balance', 400);
      }

      // Proceed with payment intent creation and saving data
      try {
        paymentIntent = await createPaymentIntent(
          service.totalPrice,
          user.currency,
          paymentMethodId,
          user.stripeCustomerId
        );

        const payment = new Payment({
          userId: user._id,
          serviceId: service._id,
          amount: service.totalPrice,
          status: 'pending',
          stripePaymentIntentId: paymentIntent.id,
        });
        await payment.save({ session });

        // Deduct the balance from the user
        await updateUserBalance(user, service.totalPrice);

        // Update service to reflect payment
        service.paymentStatus = 'paid';
        service.stripePaymentId = paymentIntent.id;
        service.status = 'purchased';
        await service.save({ session });

        res.status(200).json(new ApiResponse(200, paymentIntent, 'Service purchased successfully'));
      } catch (error) {
        throw error; // This will be caught in the transaction and handled by handleStripeError
      }
    })
    .catch((error) => {
      const { status, message, details } = handleStripeError(error);
      res.status(status).json({ message, error: details });
    });
  })
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
        res
          .status(400)
          .json(new ApiResponse(400, result, 'Domain not available'));
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
