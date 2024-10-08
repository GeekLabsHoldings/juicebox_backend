const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const Service = require('../models/serviceModel');
const User = require('../models/userModel');
const Payment = require('../models/paymentModel');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const stripe = require('../config/stripe');
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
const factory = require('../utils/handlersFactory');
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
        const file = req.files.find(
          (file) => file.fieldname === `fileUrl_${index}`,
        );
        if (file) {
          option.fileUrl = file.location;
        }
        return option;
      });

      // Create a Stripe product
      const stripeProduct = await stripe.products.create({
        name: `Service_${type}_${Date.now()}`,
        description: `Service of type: ${type}`,
        metadata: { userId: req.user._id.toString() },
        // default_price_data: {
        //   currency: req.user.currency,
        //   unit_amount: Math.round(totalPrice * 100),
        // }
      });

      service = new Service({
        type,
        options: processedOptions,
        userId: req.user._id,
        status,
        totalSteps: steps,
        currentStep: currentStep >= steps ? steps : currentStep,
        stripeProductId: stripeProduct.id,
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

// schedule a call by add date and time to service
exports.scheduleCall = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId, date, time } = req.body;

    if (!date || !time) {
      throw new ApiError('Please provide date and time', 400);
    }

    let service;

    // Transactional handling (if using session)
    await withTransaction(async (session) => {
      // Find the service by ID
      service = await Service.findById(serviceId).session(session);
      if (!service) throw new ApiError('Service not found', 404);

      // Ensure that the service status is "completed"
      if (service.status !== 'completed')
        throw new ApiError('Service is not completed', 400);

      // Find the associated user
      const user = await User.findById(service.userId).session(session);
      if (!user) throw new ApiError('User not found', 404);

      // Ensure that the user has a phone number before scheduling the call
      if (!user.phoneNumber)
        throw new ApiError('Please add your phone number first.', 400);

      // Update the service status and add the date and time
      service = await Service.findByIdAndUpdate(
        serviceId,
        {
          status: 'call-sales', // Set status to 'call-sales'
          date,                 // Update the date
          time                  // Update the time
        },
        { new: true, session }   // Return the updated document
      );
    });

    // Respond with the updated service
    res
      .status(200)
      .json(new ApiResponse(200, service, 'Service scheduled successfully'));
  })
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
    if (!paymentMethodId)
      throw new ApiError('Payment method ID is required', 400);

    let user;

    await withTransaction(async (session) => {
      // Fetch the user with relevant fields
      user = await User.findById(req.user._id)
        .select(
          'stripeCustomerId linkedCards balance currency email firstName lastName',
        )
        .session(session);
      if (!user) throw new ApiError('User not found', 404);

      // Create Stripe customer if not present
      if (!user.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        });
        user.stripeCustomerId = customer.id;
        await user.save({ session });
      }

      // Attach the payment method to the Stripe customer
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: user.stripeCustomerId,
        },
      );

      // Update user balance
      await updateBalanceInUserModel(user, session);

      // Save the linked card to the user’s document
      user.linkedCards.push({ stripePaymentMethodId: paymentMethod.id });
      await user.save({ session });
    })
      .then(() => {
        res
          .status(200)
          .json(
            new ApiResponse(
              200,
              user.linkCreditCard,
              'Card linked successfully',
            ),
          );
      })
      .catch((error) => {
        const { status, message, details } = handleStripeError(error);
        res.status(status).json({ message, error: details });
      });
  }),
);


// Purchase a service
exports.purchaseService = catchError(
  asyncHandler(async (req, res, next) => {
    const { paymentMethodId, serviceId } = req.body;

    if (!paymentMethodId || !serviceId) {
      return next(
        new ApiError("PaymentMethodId and ServiceId are required", 400)
      );
    }

    // Fetch user
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ApiError("User not found", 404));
    }

    // Create Stripe customer if it doesn't exist
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });
      customerId = customer.id;

      // Save the Stripe customer ID to the user model
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return next(new ApiError("Service not found", 404));
    }

    if (service.userId.toString() !== user._id.toString()) {
      return next(
        new ApiError("User is not authorized to purchase this service", 403)
      );
    }

    if (service.paymentStatus === "paid") {
      return next(new ApiError("Service is already paid", 400));
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!paymentMethod) throw new ApiError("Invalid Payment Method ID", 400);

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripeCustomerId,
    });

    // update customer with default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const amount = service.totalPrice * 100;

    // Create payment intent with customer information
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      customer: user.stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      description: `Payment for service: ${service.type}`,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      metadata: {
        serviceId: String(serviceId),
        stripeProductId: String(service.stripeProductId),
      },
    });

    // Extract card details from the payment method
    const last4 = paymentMethod.card.last4;
    const expMonth = paymentMethod.card.exp_month;
    const expYear = paymentMethod.card.exp_year;
    const expDate = `${expMonth}/${expYear}`;

    // Save the payment method details to the user's linkedCards array
    user.linkedCards.push({
      stripePaymentMethodId: paymentMethodId,
      last4: last4,
      expDate: expDate,
    });

    await user.save();

    // Create Payment record in MongoDB
    const payment = await Payment.create({
      userId: req.user._id,
      serviceId: serviceId,
      amount: service.totalPrice,
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user.linkCreditCard,
          "Service subscribed successfully"
        )
      );
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

// get all ser that user has purchased
exports.getUserPurchasedServices = catchError(
  asyncHandler(async (req, res) => {
    const services = await Service.find({
      userId: req.user._id,
      status: 'purchased',
    });

    res
      .status(200)
      .json(new ApiResponse(200, services, 'All Services for User retrieved'));
  }),
);

// Get service by id
exports.getService = factory.getOne(Service);
