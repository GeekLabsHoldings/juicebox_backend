const mongoose = require("mongoose");
const { Schema } = mongoose;

const serviceSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Service name is required"],
      minlength: [2, "Service name must be at least 2 characters long"],
      maxlength: [100, "Service name must be less than 100 characters long"],
    },
    details: {
      type: Schema.Types.Mixed,
      required: false,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be a positive number"],
    },
    duration: {
      type: Number,
      required: [true, "Duration is required"],
    },
    active: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Service", serviceSchema);
