const asyncHandler = require("express-async-handler");
const { catchError } = require("../middlewares/catchErrorMiddleware");
const Service = require("../models/serviceModel");
const User = require("../models/userModel");
const Payment = require("../models/paymentModel");
const ApiError = require("../utils/apiError");
const checkDomainExists = require("../services/domainService");
const stripe = require("../config/stripe");

// Save a new service as in-progress
const inProgressService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceData } = req.body;

    // Ensure serviceData contains steps
    const { options } = serviceData;
    const totalSteps = serviceData.totalSteps || 1; // Make sure to handle totalSteps

    // Set currentStep based on options length or any other desired logic
    let currentStep = options.length;

    // Check if currentStep should be set to totalSteps if the process is complete
    if (currentStep >= totalSteps) {
      currentStep = totalSteps;
      serviceData.status = "completed"; // Mark as completed if it's the last step
    } else {
      serviceData.status = "in-progress"; // Otherwise, it's still a in-progress
    }

    const service = new Service({
      ...serviceData,
      userId: req.user._id,
      serviceId: serviceData._id,
      status: serviceData.status,
      totalSteps,
      currentStep,
    });

    await service.save();

    res.status(200).send({ success: true, service });
  })
);

// Add other options (steps) to service
const continueService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId, updates } = req.body;

    // Fetch the service by ID
    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError("Service not found", 404);
    }

    // If the service is already completed
    if (service.currentStep >= service.totalSteps) {
      return res
        .status(400)
        .send({ success: false, message: "Service is already completed." });
    }

    // Check if the updates include new options
    if (updates.options !== undefined) {
      // Calculate the maximum number of options that can be added
      const remainingSteps = service.totalSteps - service.options.length;

      // Limit new options to the remaining steps
      if (updates.options.length > remainingSteps) {
        updates.options = updates.options.slice(0, remainingSteps);
      }

      // Append new options to the existing ones
      service.options = [...service.options, ...updates.options];

      // Update currentStep to the length of the new options, but not more than totalSteps
      service.currentStep = Math.min(
        service.options.length,
        service.totalSteps
      );
    }

    // Check if the updates include a specific currentStep change
    if (updates.currentStep !== undefined) {
      if (updates.currentStep > service.totalSteps || updates.currentStep < 1) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid current step provided." });
      }
      service.currentStep = updates.currentStep;
    }

    // Ensure currentStep does not exceed totalSteps
    service.currentStep = Math.min(service.currentStep, service.totalSteps);

    // Check if the service process is complete
    if (service.currentStep >= service.totalSteps) {
      service.currentStep = service.totalSteps; // Ensure currentStep does not exceed totalSteps
      service.status = "completed"; // Mark as completed if all steps are done
    } else {
      service.status = "in-progress"; // Update status if still in progress
    }

    // Save the updated service
    await service.save(); // Use save() to ensure proper handling of validation and pre-save hooks

    // Send response with updated service
    res.status(200).send({ success: true, service });
  })
);

// Call sales
const callSales = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId } = req.body;

    // Find the service by ID
    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError("Service not found", 404);
    }

    // Ensure the service is completed
    if (service.status !== "completed") {
      throw new ApiError("Service is not completed", 400);
    }

    // Fetch the user associated with the service
    const user = await User.findById(service.userId);

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    // Check if the user has a phone number
    if (!user.phoneNumber) {
      throw new ApiError("Please add your phone number first.", 400);
    }

    // Update the service status to "call-sales"
    service.status = "call-sales";

    await service.save();

    res.status(200).send({ success: true, service });
  })
);

// Cancel a service
const cancelService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId } = req.body;

    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError("Service not found", 404);
    }

    if (service.status === "purchased") {
      throw new ApiError("Cannot cancel a purchased service", 400);
    }

    await Service.findByIdAndDelete(serviceId);

    res
      .status(200)
      .send({ success: true, message: "Service canceled and deleted" });
  })
);

const linkCreditCard = catchError(
  asyncHandler(async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { paymentMethodId } = req.body;

      // Attach payment method to the customer
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: user.stripeCustomerId,
        }
      );

      // Update user's linked cards
      user.linkedCards.push({
        stripeCardId: paymentMethod.id,
      });

      await user.save();

      res
        .status(200)
        .json({ message: "Card linked successfully", card: paymentMethod });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error linking card" });
    }
  })
);

const purchaseService = catchError(
  asyncHandler(async (req, res) => {
    try {
      const { serviceId, paymentMethodId } = req.body;

      const service = await Service.findById(serviceId);

      if (!service) {
        throw new ApiError("Service not found", 404);
      }

      if (service.status === "in-progress") {
        return res
          .status(400)
          .json({ message: "Service must be completed to purchase" });
      }

      if (service.paymentStatus === "paid" && service.status === "purchased") {
        return res.status(400).json({ message: "Service already paid for" });
      }

      const user = req.user;

      let customerId = user.stripeCustomerId;

      // Check if user has a Stripe customer ID
      if (!customerId) {
        // create a dummy customer ID
        //customerId = "cus_Qm5lWNPBi5ak4s";
        
        // Create a new Stripe customer
        await stripe.paymentMethods.retrieve(
          paymentMethodId
        );
        const customer = await stripe.customers.create({
          payment_method: paymentMethodId,
          email: user.email, // Assuming you have user's email
          description: `Customer for ${user._id}`,
          customerId: customer.id
        });

        // Save the new customer ID to the user
        user.stripeCustomerId = customer.id;
        await user.save();

        customerId = user.customerId;
      }

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: service.totalPrice * 100, // Stripe requires the amount in cents
        currency: "usd",
        payment_method: paymentMethodId,
        customer: customerId,
        confirm: true, // Automatically confirm the payment
        // return_url: "https://your-website.com/return-url",
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never", // Avoid redirects
        }
      });

      // Save the payment details in the Payment model
      const payment = new Payment({
        userId: user._id,
        serviceId: service._id,
        amount: service.totalPrice,
        status: "pending",
        stripePaymentIntentId: paymentIntent.id,
      });

      await payment.save();

      // Update the service with the payment status
      service.paymentStatus = "paid";
      service.stripePaymentId = paymentIntent.id;
      service.status = "purchased";
      await service.save();

      res.status(200).json({ message: "Payment successful", paymentIntent });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Payment failed", error: error.message });
    }
  })
);

const validateDomain = catchError(
  asyncHandler(async (req, res) => {
    const { domain } = req.body;

    if (!domain) {
      throw new ApiError("Domain is required", 400);
    }

    try {
      const result = await checkDomainExists(domain);

      if (result.available) {
        res.status(200).send({
          success: true,
          message: result.message,
          prices: result.prices,
        });
      } else {
        res.status(200).send({
          success: false,
          message: "Domain is not available",
          suggestions: result.suggestions,
        });
      }
    } catch (error) {
      if (error.message.startsWith("The TLD")) {
        res.status(400).send({ success: false, message: error.message });
      } else {
        console.error("Error checking domain availability:", error);
        throw new ApiError("Error checking domain availability", 500);
      }
    }
  })
);

// const stripeWebhook = catchError(
//   asyncHandler(async (req, res) => {
//     const sig = req.headers['stripe-signature'];
//     const payload = req.body;

//     let event;

//     try {
//       event = PaymentService.verifyWebhookSignature(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
//     } catch (err) {
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     // Handle the event types you care about
//     switch (event.type) {
//       case 'payment_intent.succeeded':
//         const paymentIntent = event.data.object;
//         // Fulfill the purchase or update service status
//         await fulfillServicePurchase(paymentIntent);
//         break;
//       case 'payment_intent.payment_failed':
//         const failedIntent = event.data.object;
//         // Handle the failed payment
//         await handleFailedPayment(failedIntent);
//         break;
//       // ... handle other event types
//       default:
//         console.log(`Unhandled event type ${event.type}`);
//     }

//     res.status(200).send({ received: true });
//   })
// );

// Purchase a service
// const purchaseService = catchError(
//   asyncHandler(async (req, res) => {
//     const { serviceId } = req.body;
//     const user = await User.findById(req.user.id);
//     const service = await Service.findById(serviceId);

//     if (!service) {
//       throw new ApiError('Service not found', 404);
//     }

//     if (!user.stripePaymentMethodId) {
//       throw new ApiError('No linked credit card found. Please link a card first.', 400);
//     }

//     // Create a payment intent for the service
//     const clientSecret = await PaymentService.createPaymentIntent(service.totalPrice, 'usd', user.stripeCustomerId);

//     // Confirm the payment
//     const payment = await PaymentService.chargePayment(clientSecret);

//     // Update service status to 'purchased'
//     service.status = 'purchased';
//     await service.save();

//     res.status(200).json({ success: true, service, payment });
//   })
// );

// const linkCreditCard = catchError(
//   asyncHandler(async (req, res) => {
//     const { paymentMethodId } = req.body;
//     const user = await User.findById(req.user.id);

//     if (!user.stripeCustomerId) {
//       // If user doesn't have a Stripe customer, create one
//       const customerId = await PaymentService.createCustomer(user.email);
//       user.stripeCustomerId = customerId;
//     }

//     // Link the payment method to the Stripe customer
//     await PaymentService.addPaymentMethod(user.stripeCustomerId, paymentMethodId);
//     user.stripePaymentMethodId = paymentMethodId;

//     await user.save();

//     res.status(200).json({ success: true, message: 'Credit card linked successfully.' });
//   })
// );

// const buyService = catchError(
//   asyncHandler(async (req, res) => {
//     const { userId, serviceId, paymentMethodId, paymentType } = req.body;

//     const service = await Service.findById(serviceId);
//     const user = await User.findById(userId);

//     if (!service || !user) {
//       throw new ApiError("Service or User not found", 404);
//     }

//     if (service.status !== "completed") {
//       throw new ApiError("Service must be completed to purchase", 400);
//     }

//     let paymentIntent;
//     if (paymentType === "stripe") {
//       paymentIntent = await PaymentService.createPaymentIntent(
//         service.totalPrice,
//         "usd",
//         paymentMethodId,
//         null,
//         null
//       );
//     } else if (paymentType === "visa") {
//       if (!user.stripeCustomerId || !user.paymentMethod.token) {
//         return res
//           .status(400)
//           .send("No Stripe customer or payment method found for this user");
//       }

//       paymentIntent = await PaymentService.createPaymentIntent(
//         service.totalPrice,
//         "usd",
//         null,
//         user.stripeCustomerId,
//         user.paymentMethod.token,
//         true // off_session
//       );
//     } else {
//       return res.status(400).send("Invalid payment type");
//     }

//     await PaymentService.createPaymentRecord(
//       userId,
//       serviceId,
//       paymentIntent,
//       paymentType,
//       paymentMethodId
//     );

//     service.status = "purchased";
//     await service.save();

//     res.status(200).send({ success: true, payment });
//   })
// );

// const linkCard = catchError(
//   asyncHandler(async (req, res) => {
//     const { userId, cardToken } = req.body;

//     try {
//       const customer = await PaymentService.linkCardToCustomer(
//         userId,
//         cardToken
//       );
//       res.status(200).send({ success: true, customer });
//     } catch (error) {
//       console.error("Error linking card:", error);
//       res.status(500).send({ error: error.message });
//     }
//   })
// );

module.exports = {
  purchaseService,
  inProgressService,
  continueService,
  cancelService,
  linkCreditCard,
  validateDomain,
  callSales,
};
