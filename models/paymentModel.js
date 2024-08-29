const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for user-based lookups
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true, // Index for service-based lookups
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true, // Index payment date for chronological queries
    },
    paymentMethod: {
      cardType: {
        type: String,
        enum: ["visa", "stripe"],
        index: true, // Index for filtering by card type
      },
      cardNumberLast4: {
        type: String,
        trim: true,
        sparse: true, // Allow nulls while indexing
      },
      token: {
        type: String,
        trim: true,
      },
      expirationDate: {
        type: String,
        trim: true,
      },
      isDefault: {
        type: Boolean,
        default: false,
        index: true, // Index for quick lookup of default payment method
      },
    },
    transactionId: {
      type: String,
      required: [true, "Transaction ID is required"],
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      index: true, // Index for status-based queries
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
