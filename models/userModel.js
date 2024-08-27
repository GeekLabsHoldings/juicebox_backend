const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      minlength: [2, "First name must be at least 2 characters long"],
      maxlength: [50, "First name must be less than 50 characters long"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      minlength: [2, "Last name must be at least 2 characters long"],
      maxlength: [50, "Last name must be less than 50 characters long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    DOB: {
      type: Date,
      required: [true, "Date of Birth is required"],
    },
    ISD: {
      type: String,
      required: [true, "Country code is required"],
    },
    country: {
      type: String,
      minlength: [2, "Country must be at least 2 characters long"],
      maxlength: [50, "Country must be less than 50 characters long"],
    },
    address: {
      type: String,
      minlength: [2, "Address must be at least 2 characters long"],
      maxlength: [100, "Address name must be less than 50 characters long"],
    },
    city: {
      type: String,
      minlength: [2, "City must be at least 2 characters long"],
      maxlength: [50, "City must be less than 50 characters long"],
    },
    org: {
      type: String,
      minlength: [2, "Org must be at least 2 characters long"],
      maxlength: [50, "Org must be less than 50 characters long"],
    },
    position: {
      type: String,
      minlength: [2, "Position must be at least 2 characters long"],
      maxlength: [50, "Position must be less than 50 characters long"],
    },
    active: {
      type: Boolean,
      default: true,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetCode: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    passwordResetVerified: {
      type: Boolean,
    },
    verifyEmail: {
      type: Boolean,
      default: false,
    },
    stripeCustomerId: {
      type: String,
    },
    paymentMethod: {
      cardType: {
        type: String,
      },
      token: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  // Hashing user password
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
