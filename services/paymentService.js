const stripe = require("../config/stripe");
const Payment = require("../models/paymentModel");
const Service = require("../models/serviceModel");

exports.stripeWebhook = async (req, res) => {
  let event;

  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    // Handle the event based on its type
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;

        // Step 1: Find the payment record
        const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        // Step 2: Update payment and service status
        payment.status = 'completed';
        await payment.save();

        const service = await Service.findById(payment.serviceId);
        service.paymentStatus = 'paid';
        service.status = 'purchased'; // Update service status to purchased
        await service.save();

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;

        // Step 1: Find the payment record
        const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        // Step 2: Update payment and service status
        payment.status = 'failed';
        await payment.save();

        const service = await Service.findById(payment.serviceId);
        service.paymentStatus = 'failed';
        await service.save();

        break;
      }

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

exports.createPaymentIntent = async (amount, currency, paymentMethodId, customerId, metadata) => {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe requires amounts in cents
    currency: currency,
    payment_method: paymentMethodId,
    customer: customerId,
    confirm: true,
    metadata: metadata,
  });
};

// exports.createPaymentIntent = async (amount, currency, paymentMethodId, customerId, metadata) => {
//   return await stripe.paymentIntents.create({
//     amount: Math.round(amount * 100),
//     currency,
//     payment_method: paymentMethodId,
//     customer: customerId,
//     confirm: true,
//     description: `Payment for service: ${metadata.serviceType}`, // Optionally add a description
//     automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
//     metadata,  // Pass the metadata here
//   });
// };
