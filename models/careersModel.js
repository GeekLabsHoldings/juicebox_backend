const mongoose = require("mongoose");
const validator = require("validator");

const careerModel = new mongoose.Schema(
  {
    name: {
      type: String,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name must be less than 50 characters long"],
      index: true, // Indexing first name for faster lookups
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      index: true, // Indexing email for uniqueness and quick lookups
    },
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: (value) => {
          return validator.isMobilePhone(value, "any", { strictMode: false });
        },
        message: "Please provide a valid phone number",
      },
    },
    cv: {
      type: String, // URL or path to uploaded CV file
      required: [true, "CV is required"],
    },
    portfolioLink: {
      type: String,
      trim: true,
      validate: {
        validator: (value) =>
          validator.isURL(value, {
            protocols: ["http", "https"],
            require_protocol: true,
          }),
        message: "Please provide a valid URL for the portfolio",
      },
    },
    linkedInLink: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => {
          return validator.isURL(value) && value.includes("linkedin.com");
        },
        message: "Please provide a valid LinkedIn profile URL",
      },
    },
    vacancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vacancy",
    },
  },
  {
    timestamps: true,
  }
);

const Career = mongoose.model("Career", careerModel);

module.exports = Career;
