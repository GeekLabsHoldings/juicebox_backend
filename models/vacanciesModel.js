const mongoose = require("mongoose");

const vacanciesModel = new mongoose.Schema(
  {
    title: {
      type: String,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name must be less than 50 characters long"],
      trim: true,
      index: true, // Indexing first name for faster lookups
    },
    description: {
      type: String,
      minlength: [2, "Description must be at least 2 characters long"],
      maxlength: [1000, "Description must be less than 1000 characters long"],
      trim: true,
    },
    requirements: {
      type: String,
      minlength: [2, "Requirements must be at least 2 characters long"],
      maxlength: [1000, "Requirements must be less than 1000 characters long"],
      trim: true,
    },
    benefits: {
      type: String,
      minlength: [2, "Benefits must be at least 2 characters long"],
      maxlength: [1000, "Benefits must be less than 1000 characters long"],
      trim: true,
    },
    responsibilities: {
      type: String,
      minlength: [2, "Responsibilities must be at least 2 characters long"],
      maxlength: [1000, "Responsibilities must be less than 1000 characters long"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Vacancy = mongoose.model("Vacancy", vacanciesModel);

module.exports = Vacancy;
