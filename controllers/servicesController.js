const asyncHandler = require("express-async-handler");
const { catchError } = require("../middlewares/cacheMiddleware");
const PaymentService = require("../services/paymentService");
const Service = require("../models/serviceModel");
const User = require("../models/userModel");
const ApiError = require("../utils/apiError");
const checkDomainExists = require("../services/domainService");

// Save a new service as in-progress
const inProgressService = catchError(
  asyncHandler(async (req, res) => {
    const { userId, serviceData } = req.body;

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
      userId,
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
      // Append new options to the existing ones
      service.options = [...service.options, ...updates.options];
      // Set currentStep based on the length of the updated options
      service.currentStep = service.options.length;
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
    if (service.currentStep > service.totalSteps) {
      service.currentStep = service.totalSteps;
    }

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

// Purchase a service
const buyService = catchError(
  asyncHandler(async (req, res) => {
    const { userId, serviceId, paymentMethodId, paymentType } = req.body;

    const service = await Service.findById(serviceId);
    const user = await User.findById(userId);

    if (!service || !user) {
      throw new ApiError("Service or User not found", 404);
    }

    if (service.status !== "completed") {
      throw new ApiError("Service must be completed to purchase", 400);
    }

    let paymentIntent;
    if (paymentType === "stripe") {
      paymentIntent = await PaymentService.createPaymentIntent(
        service.totalPrice,
        "usd",
        paymentMethodId,
        null,
        null
      );
    } else if (paymentType === "visa") {
      if (!user.stripeCustomerId || !user.paymentMethod.token) {
        return res
          .status(400)
          .send("No Stripe customer or payment method found for this user");
      }

      paymentIntent = await PaymentService.createPaymentIntent(
        service.totalPrice,
        "usd",
        null,
        user.stripeCustomerId,
        user.paymentMethod.token,
        true // off_session
      );
    } else {
      return res.status(400).send("Invalid payment type");
    }

    await PaymentService.createPaymentRecord(
      userId,
      serviceId,
      paymentIntent,
      paymentType,
      paymentMethodId
    );

    service.status = "purchased";
    await service.save();

    res.status(200).send({ success: true, payment });
  })
);

const linkCard = catchError(
  asyncHandler(async (req, res) => {
    const { userId, cardToken } = req.body;

    try {
      const customer = await PaymentService.linkCardToCustomer(
        userId,
        cardToken
      );
      res.status(200).send({ success: true, customer });
    } catch (error) {
      console.error("Error linking card:", error);
      res.status(500).send({ error: error.message });
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

module.exports = {
  buyService,
  inProgressService,
  continueService,
  cancelService,
  linkCard,
  validateDomain,
};
