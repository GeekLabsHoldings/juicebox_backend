const mongoose = require("mongoose");
const ApiError = require("../utils/apiError");

const optionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  choice: { type: String, required: true, trim: true },
  ans: { type: String, trim: true },
  data: {
    fieldOne: { type: String, trim: true },
    fieldTwo: { type: String, trim: true },
    fieldThree: { type: String, trim: true },
    fieldFour: { type: String, trim: true },
    fieldFive: { type: String, trim: true },
  },
  fileUrl: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  duration: { type: Number, required: true, min: 0 },
});

const serviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for quick user-based lookups
    },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true, // Index service type for quick filtering
    },
    options: [optionSchema],
    status: {
      type: String,
      enum: ["in-progress", "purchased", "completed", "call-sales"],
      default: "in-progress",
      index: true, // Index service status for quick filtering
    },
    totalPrice: {
      type: Number,
    },
    estimatedDuration: {
      type: Number,
    },
    currentStep: {
      type: Number,
      default: 1,
    },
    totalSteps: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    stripePaymentId: {
      type: String,
      index: true,  // Index for quick lookups
    },
  },
  {
    timestamps: true,
  }
);

// Middleware to calculate total price and duration
serviceSchema.pre("save", async function (next) {
  try {
    let totalPrice = 0;
    let totalDuration = 0;

    this.options.forEach((option) => {
      totalPrice += option.price;
      totalDuration += option.duration;
    });

    this.totalPrice = totalPrice;
    this.estimatedDuration = totalDuration;

    next();
  } catch (error) {
    next(new ApiError("Error calculating totals", 500));
  }
});

const Service = mongoose.model("Service", serviceSchema);

module.exports = Service;
