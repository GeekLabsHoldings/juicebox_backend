const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/userModel");
const Payment = require("../models/paymentModel");
const asyncHandler = require("express-async-handler");
const { catchError } = require("../middlewares/cacheMiddleware");
const ApiError = require("../utils/apiError");

// Create a PaymentIntent with Stripe
const createPaymentIntent = async (
  amount,
  currency,
  paymentMethodId,
  customerId,
  paymentMethodToken,
  offSession = false
) => {
  if (paymentMethodId) {
    return await stripe.paymentIntents.create({
      amount: amount * 100, // Amount in cents
      currency,
      payment_method: paymentMethodId,
      confirm: true,
    });
  } else if (customerId && paymentMethodToken) {
    return await stripe.paymentIntents.create({
      amount: amount * 100, // Amount in cents
      currency,
      customer: customerId,
      payment_method: paymentMethodToken,
      off_session: offSession,
      confirm: true,
    });
  } else {
    throw new Error("Invalid payment parameters");
  }
};

// Link a Visa card to a Stripe customer
const linkCardToCustomer = async (userId, cardToken) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  let customer;
  if (user.stripeCustomerId) {
    customer = await stripe.customers.retrieve(user.stripeCustomerId);
  } else {
    customer = await stripe.customers.create();
    user.stripeCustomerId = customer.id;
    await user.save();
  }

  const paymentMethod = await stripe.paymentMethods.attach(cardToken, {
    customer: customer.id,
  });

  await stripe.customers.update(customer.id, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  user.paymentMethod = {
    cardType: "visa",
    token: cardToken,
  };
  await user.save();

  return customer;
};

// Create a payment record in the database
const createPaymentRecord = async (
  userId,
  serviceId,
  paymentIntent,
  paymentType,
  paymentMethodId
) => {
  const payment = new Payment({
    user: userId,
    service: serviceId,
    transactionId: paymentIntent.id,
    paymentMethod: {
      cardType: paymentType,
      token: paymentMethodId,
    },
    status: paymentIntent.status === "succeeded" ? "completed" : "pending",
  });

  return await payment.save();
};

const paymentWebhook = catchError(
  asyncHandler(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        await Payment.updateOne(
          { transactionId: paymentIntent.id },
          { status: "completed" }
        );
        break;
      case "payment_intent.payment_failed":
        const failedIntent = event.data.object;
        await Payment.updateOne(
          { transactionId: failedIntent.id },
          { status: "failed" }
        );
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  })
);

module.exports = {
  paymentWebhook,
  createPaymentIntent,
  linkCardToCustomer,
  createPaymentRecord,
};
