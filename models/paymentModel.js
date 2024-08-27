const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      cardType: {
        type: String,
        enum: ["visa", "stripe"],
      },
      cardNumberLast4: {
        type: String,
      },
      token: {
        type: String,
      },
      expirationDate: {
        type: String,
      },
      isDefault: {
        type: Boolean,
      }, 
    },
    transactionId: {
      type: String,
      required: [true, "Transaction ID is required"],
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
