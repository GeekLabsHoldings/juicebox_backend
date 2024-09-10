const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

const optionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
});

const processServiceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true, // Index for quick lookups by serviceId
    },
    options: [optionSchema],
    status: {
      type: String,
      enum: ['in-progress', 'completed'],
      default: 'in-progress',
      index: true,
    },
    totalProgressPercentage: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Middleware to calculate total progress percentage and update status
processServiceSchema.pre('save', async function (next) {
  try {
    // Calculate total number of options and completed options
    const totalOptions = this.options.length;
    const completedOptions = this.options.filter(
      (option) => option.done,
    ).length;

    // Calculate progress percentage (if there are options)
    this.totalProgressPercentage =
      totalOptions > 0 ? (completedOptions / totalOptions) * 100 : 0;

    // Automatically set status to 'completed' if totalProgressPercentage is 100
    if (this.totalProgressPercentage === 100) {
      this.status = 'completed';
    } else {
      this.status = 'in-progress';
    }

    next();
  } catch (error) {
    next(new ApiError('Error calculating total progress', 500));
  }
});

const Process = mongoose.model('Process', processServiceSchema);

module.exports = Process;
