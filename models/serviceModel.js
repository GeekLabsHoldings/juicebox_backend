const mongoose = require("mongoose");
const ApiError = require("../utils/apiError");

const optionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  choice: { type: String, required: true },
  ans: { type: String },
  price: { type: Number, required: true, min: 0 },
  duration: { type: Number, required: true, min: 0 },
});

const serviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  options: [optionSchema],
  status: {
    type: String,
    enum: ["draft", "in-progress", "purchased"],
    default: "draft",
  },
  totalPrice: { type: Number, required: false },
  estimatedDuration: { type: Number, required: false },
  currentStep: { type: Number, default: 1 }, // Track the current step
  totalSteps: { type: Number, required: true }, // Total number of steps
});

serviceSchema.pre("save", async function (next) {
  try {
    // Calculate total price and estimated duration
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
    next(
      new ApiError("Error checking domain existence or calculating totals", 500)
    );
  }
});

const Service = mongoose.model("Service", serviceSchema);

module.exports = Service;
