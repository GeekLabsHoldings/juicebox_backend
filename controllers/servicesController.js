const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const Service = require('../models/serviceModel');
const User = require('../models/userModel');
const Payment = require('../models/paymentModel');
const Process = require('../models/serviceProcessModel');
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

// Save a new service as completed
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

      // Create 5 initial dummy processes for the service
      const processOptions = [
        { name: 'Initial Consultation', done: false },
        { name: 'Design Process', done: false },
        { name: 'Development Process', done: false },
        { name: 'Testing Process', done: false },
        { name: 'Final Delivery', done: false },
      ];
      const process = new Process({
        serviceId: service._id,
        options: processOptions,
        totalProgressPercentage: 0,
      });

      await process.save({ session });

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
          date, // Update the date
          time, // Update the time
        },
        { new: true, session }, // Return the updated document
      );
    });

    // Respond with the updated service
    res
      .status(200)
      .json(new ApiResponse(200, service, 'Service scheduled successfully'));
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

// Link a credit card, verify it with a test charge, and retrieve balance
exports.linkCreditCard = catchError(
  asyncHandler(async (req, res) => {
    const { paymentMethodId } = req.body;
    if (!paymentMethodId)
      throw new ApiError('Payment method ID is required', 400);

    // Fetch the user with relevant fields
    const user = await User.findById(req.user._id).select(
      'stripeCustomerId linkedCards balance currency email firstName lastName',
    );
    if (!user) throw new ApiError('User not found', 404);

    // Create Stripe customer if not present
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    // Attach the payment method to the Stripe customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripeCustomerId,
    });

    // Check if paymentMethodId already exists in user's linkedCards
    const isPaymentMethodExists = user.linkedCards.some(
      (card) => card.stripePaymentMethodId === paymentMethodId,
    );

    // Save payment method details only if it doesn't already exist
    if (isPaymentMethodExists) {
      throw new ApiError('Payment method already exists', 400);
    }

    const { last4, exp_month, exp_year } = paymentMethod.card;
    user.linkedCards.push({
      stripePaymentMethodId: paymentMethodId,
      last4: last4,
      expDate: `${exp_month}/${exp_year}`,
    });
    
    await user.save();

    // Optionally: Verify the payment method by creating a test charge
    const verificationAmount = 100; // Amount in cents (e.g., $1 for verification)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: verificationAmount,
      currency: 'usd',
      payment_method: paymentMethodId,
      customer: user.stripeCustomerId,
      confirm: true,
      capture_method: 'automatic',
    });

    // Immediately refund the verification charge after successful charge
    await stripe.refunds.create({
      payment_intent: paymentIntent.id,
    });

    // Retrieve balance from Stripe after successful card linking and verification
    const balance = await stripe.balance.retrieve();

    // Extract the available balance and currency
    const availableBalance = balance.available[0].amount; // Amount in cents
    const currency = balance.available[0].currency;

    // Save balance and currency to the user's document
    user.balance = availableBalance;
    user.currency = currency;

    await user.save();

    // Send response with the updated card details, balance, and currency
    res.status(200).json(
      new ApiResponse(
        200,
        {
          linkedCards: user.linkedCards,
          balance: user.balance,
          currency: user.currency,
        },
        'Card linked, verified, and balance retrieved successfully',
      ),
    );
  }),
);

// Purchase a service
exports.purchaseService = catchError(
  asyncHandler(async (req, res, next) => {
    const { paymentMethodId, serviceId } = req.body;

    if (!paymentMethodId || !serviceId) {
      return next(
        new ApiError('PaymentMethodId and ServiceId are required', 400),
      );
    }

    // Fetch user
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ApiError('User not found', 404));
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
      return next(new ApiError('Service not found', 404));
    }

    if (service.userId.toString() !== user._id.toString()) {
      return next(
        new ApiError('User is not authorized to purchase this service', 403),
      );
    }

    if (service.paymentStatus === 'paid') {
      return next(new ApiError('Service is already paid', 400));
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!paymentMethod) throw new ApiError('Invalid Payment Method ID', 400);

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
      currency: 'usd',
      customer: user.stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      description: `Payment for service: ${service.type}`,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        serviceId: String(serviceId),
        stripeProductId: String(service.stripeProductId),
      },
    });

    // Check if paymentMethodId already exists in user's linkedCards
    const isPaymentMethodExists = user.linkedCards.some(
      (card) => card.stripePaymentMethodId === paymentMethodId,
    );

    // Save payment method details only if it doesn't already exist
    if (!isPaymentMethodExists) {
      const { last4, exp_month, exp_year } = paymentMethod.card;
      user.linkedCards.push({
        stripePaymentMethodId: paymentMethodId,
        last4: last4,
        expDate: `${exp_month}/${exp_year}`,
      });
      await user.save();
    }

    // Create Payment record in MongoDB
    const payment = await Payment.create({
      userId: req.user._id,
      serviceId: serviceId,
      amount: service.totalPrice,
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, payment.id, 'Service subscribed successfully'),
      );
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

    // Retrieve payment data for each service
    const servicesWithPayments = await Promise.all(
      services.map(async (service) => {
        const payment = await Payment.findOne({
          serviceId: service._id,
          userId: req.user._id,
        });

        return {
          service,
          payment,
        };
      }),
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          servicesWithPayments,
          'All Services with Payments retrieved',
        ),
      );
  }),
);

// Get service by id
exports.getService = factory.getOne(Service);
