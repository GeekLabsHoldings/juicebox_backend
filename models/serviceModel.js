const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

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
  fileUrl: { 
    type: String,
  },
  s3Key: {
    type: String,
  },
  price: { type: Number, min: 0 },
  duration: { type: Number, min: 0 },
});

const serviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
      enum: ['in-progress', 'purchased', 'completed', 'call-sales'],
      default: 'in-progress',
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
    date: {
      type: String,
    },
    time: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    stripePaymentId: {
      type: String,
      index: true, // Index for quick lookups
    },
  },
  {
    timestamps: true,
  },
);

// Middleware to calculate total price and duration
serviceSchema.pre('save', async function (next) {
  try {
    let totalPrice = 0;
    let totalDuration = 0;

    // Ensure options are present and iterate over them
    if (this.options && Array.isArray(this.options)) {
      this.options.forEach((option) => {
        // Ensure that price and duration are valid numbers
        const price = option.price || 0;
        const duration = option.duration || 0;

        if (typeof price !== 'number' || price < 0) {
          throw new ApiError(`Invalid price value in option: ${option.name}`, 400);
        }

        if (typeof duration !== 'number' || duration < 0) {
          throw new ApiError(`Invalid duration value in option: ${option.name}`, 400);
        }

        // Accumulate the total price and duration
        totalPrice += price;
        totalDuration += duration;
      });
    }

    // Set the calculated values
    this.totalPrice = totalPrice;
    this.estimatedDuration = totalDuration;

    // Check if the status is not 'call-sales', and remove the date and time fields
    if (this.status !== 'call-sales') {
      this.date = undefined;
      this.time = undefined;
    }

    next();
  } catch (error) {
    next(new ApiError('Error calculating totals: ' + error.message, 500));
  }
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
