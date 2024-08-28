const asyncHandler = require("express-async-handler");
const { catchError } = require("../middlewares/cacheMiddleware");
const PaymentService = require("../services/paymentService");
const Service = require("../models/serviceModel");
const User = require("../models/userModel");
const ApiError = require("../utils/apiError");
const checkDomainExists = require("../services/domainService");

// Save a new service as draft
const saveAsDraft = catchError(
  asyncHandler(async (req, res) => {
    const { userId, serviceData } = req.body;

    // Ensure serviceData contains steps
    const { options } = serviceData;
    const totalSteps = serviceData.totalSteps || 1;  // Make sure to handle totalSteps

    // Set currentStep based on options length or any other desired logic
    const currentStep = options.length > 0 ? options.length : 1; 

    const service = new Service({
      ...serviceData,
      userId,
      status: "draft",
      totalSteps,
      currentStep,  // Ensure to reflect the desired logic
    });

    await service.save();

    res.status(200).send({ success: true, service });
  })
);

// Continue to the next step
const continueService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId, updates } = req.body;

    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError("Service not found", 404);
    }

    // Apply updates to the service
    Object.assign(service, updates);

    if (service.currentStep < service.totalSteps) {
      service.currentStep += 1;
      service.status = "in-progress";
    } else {
      service.status = "completed"; // Optional: Update status to completed when all steps are done
    }

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

// Purchase a service
const buyService = catchError(
  asyncHandler(async (req, res) => {
    const { userId, serviceId, paymentMethodId, paymentType } = req.body;

    const service = await Service.findById(serviceId);
    const user = await User.findById(userId);

    if (!service || !user) {
      throw new ApiError("Service or User not found", 404);
    }

    if (service.status !== "in-progress") {
      throw new ApiError("Service must be in progress to purchase", 400);
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
        res.status(200).send({ success: true, message: "Domain is available" });
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
  saveAsDraft,
  continueService,
  cancelService,
  linkCard,
  validateDomain,
};
