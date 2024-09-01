const stripe = require("../config/stripe");
const Payment = require("../models/paymentModel");
const Service = require("../models/serviceModel");

exports.stripeWebhook = async (req, res) => {
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });

        if (payment) {
          payment.status = "completed";
          await payment.save();

          const service = await Service.findById(payment.serviceId);
          service.paymentStatus = "paid";
          await service.save();
        }
        break;

      case "payment_intent.payment_failed":
        const failedPaymentIntent = event.data.object;
        const failedPayment = await Payment.findOne({ stripePaymentIntentId: failedPaymentIntent.id });

        if (failedPayment) {
          failedPayment.status = "failed";
          await failedPayment.save();

          const failedService = await Service.findById(failedPayment.serviceId);
          failedService.paymentStatus = "failed";
          await failedService.save();
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error(error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const asyncHandler = require("express-async-handler");

// class PaymentService {
//   static async createCustomer(email) {
//     const customer = await stripe.customers.create({ email });
//     return customer.id;
//   }

//   static async addPaymentMethod(customerId, paymentMethodId) {
//     await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
//     await stripe.customers.update(customerId, {
//       invoice_settings: { default_payment_method: paymentMethodId },
//     });
//   }

//   static async createPaymentIntent(amount, currency = 'usd', customerId) {
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount,
//       currency,
//       customer: customerId,
//       payment_method_types: ['card'],
//     });
//     return paymentIntent.client_secret;
//   }

//   static async chargePayment(paymentIntentId) {
//     const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
//     return paymentIntent;
//   }

//   static verifyWebhookSignature(payload, signature, secret) {
//     try {
//       return stripe.webhooks.constructEvent(payload, signature, secret);
//     } catch (err) {
//       throw new ApiError('Webhook signature verification failed', 400);
//     }
//   }
// }

// // @desc    This webhook will run when stripe payment success paid
// // @route   POST /webhook-checkout
// // @access  Protected/User
// exports.webhookCheckout = asyncHandler(async (req, res, next) => {
//   const sig = req.headers['stripe-signature'];

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err) {
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }
//   if (event.type === 'checkout.session.completed') {
//     //  Create order
//     createCardOrder(event.data.object);
//   }

//   res.status(200).json({ received: true });
// });

// module.exports = PaymentService;


// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const User = require("../models/userModel");
// const Payment = require("../models/paymentModel");
// const asyncHandler = require("express-async-handler");
// const { catchError } = require("../middlewares/cacheMiddleware");

// // Create a PaymentIntent with Stripe
// const createPaymentIntent = async (
//   amount,
//   currency,
//   paymentMethodId,
//   customerId,
//   paymentMethodToken,
//   offSession = false
// ) => {
//   if (paymentMethodId) {
//     return await stripe.paymentIntents.create({
//       amount: amount * 100, // Amount in cents
//       currency,
//       payment_method: paymentMethodId,
//       confirm: true,
//     });
//   } else if (customerId && paymentMethodToken) {
//     return await stripe.paymentIntents.create({
//       amount: amount * 100, // Amount in cents
//       currency,
//       customer: customerId,
//       payment_method: paymentMethodToken,
//       off_session: offSession,
//       confirm: true,
//     });
//   } else {
//     throw new Error("Invalid payment parameters");
//   }
// };

// // Link a Visa card to a Stripe customer
// const linkCardToCustomer = async (userId, cardToken) => {
//   const user = await User.findById(userId);

//   if (!user) {
//     throw new Error("User not found");
//   }

//   let customer;
//   if (user.stripeCustomerId) {
//     customer = await stripe.customers.retrieve(user.stripeCustomerId);
//   } else {
//     customer = await stripe.customers.create();
//     user.stripeCustomerId = customer.id;
//     await user.save();
//   }

//   const paymentMethod = await stripe.paymentMethods.attach(cardToken, {
//     customer: customer.id,
//   });

//   await stripe.customers.update(customer.id, {
//     invoice_settings: {
//       default_payment_method: paymentMethod.id,
//     },
//   });

//   user.paymentMethod = {
//     cardType: "visa",
//     token: cardToken,
//   };
//   await user.save();

//   return customer;
// };

// // Create a payment record in the database
// const createPaymentRecord = async (
//   userId,
//   serviceId,
//   paymentIntent,
//   paymentType,
//   paymentMethodId
// ) => {
//   const payment = new Payment({
//     user: userId,
//     service: serviceId,
//     transactionId: paymentIntent.id,
//     paymentMethod: {
//       cardType: paymentType,
//       token: paymentMethodId,
//     },
//     status: paymentIntent.status === "succeeded" ? "completed" : "pending",
//   });

//   return await payment.save();
// };

// const paymentWebhook = catchError(
//   asyncHandler(async (req, res) => {
//     const sig = req.headers["stripe-signature"];
//     let event;

//     try {
//       event = stripe.webhooks.constructEvent(
//         req.body,
//         sig,
//         process.env.STRIPE_WEBHOOK_SECRET
//       );
//     } catch (err) {
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     switch (event.type) {
//       case "payment_intent.succeeded":
//         const paymentIntent = event.data.object;
//         await Payment.updateOne(
//           { transactionId: paymentIntent.id },
//           { status: "completed" }
//         );
//         break;
//       case "payment_intent.payment_failed":
//         const failedIntent = event.data.object;
//         await Payment.updateOne(
//           { transactionId: failedIntent.id },
//           { status: "failed" }
//         );
//         break;
//       default:
//         console.log(`Unhandled event type ${event.type}`);
//     }

//     res.json({ received: true });
//   })
// );

// module.exports = {
//   paymentWebhook,
//   createPaymentIntent,
//   linkCardToCustomer,
//   createPaymentRecord,
// };
