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

exports.attachPaymentMethod = async (user, paymentMethodId) => {
  return await stripe.paymentMethods.attach(paymentMethodId, {
    customer: user.stripeCustomerId,
  });
};

exports.createPaymentIntent = async (amount, currency, paymentMethodId, customerId) => {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    payment_method: paymentMethodId,
    customer: customerId,
    confirm: true,
    automatic_payment_methods: { enabled: true },
  });
};
