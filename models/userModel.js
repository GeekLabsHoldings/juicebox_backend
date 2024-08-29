const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      minlength: [2, "First name must be at least 2 characters long"],
      maxlength: [50, "First name must be less than 50 characters long"],
      trim: true,
      index: true, // Indexing first name for faster lookups
    },
    lastName: {
      type: String,
      minlength: [2, "Last name must be at least 2 characters long"],
      maxlength: [50, "Last name must be less than 50 characters long"],
      trim: true,
      index: true, // Indexing last name
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true, // Ensure email is always stored in lowercase
      trim: true,
      index: true, // Indexing email for uniqueness and quick lookups
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters long"],
      select: false, // Prevent returning password in queries by default
    },
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true, // Index but allow nulls or missing values
    },
    avatar: String,
    avatarPublicId: String,
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true, // Index role for faster queries based on user roles
    },
    DOB: {
      type: Date,
      index: true, // Indexing for age-related queries
    },
    ISD: {
      type: String,
      index: true, // Index ISD for quicker lookups based on country code
    },
    country: {
      type: String,
      minlength: [2, "Country must be at least 2 characters long"],
      maxlength: [50, "Country must be less than 50 characters long"],
      trim: true,
    },
    address: {
      type: String,
      minlength: [2, "Address must be at least 2 characters long"],
      maxlength: [100, "Address name must be less than 100 characters long"],
      trim: true,
    },
    city: {
      type: String,
      minlength: [2, "City must be at least 2 characters long"],
      maxlength: [50, "City must be less than 50 characters long"],
      trim: true,
      index: true, // Index city for location-based queries
    },
    org: {
      type: String,
      minlength: [2, "Org must be at least 2 characters long"],
      maxlength: [50, "Org must be less than 50 characters long"],
      trim: true,
    },
    position: {
      type: String,
      minlength: [2, "Position must be at least 2 characters long"],
      maxlength: [50, "Position must be less than 50 characters long"],
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true, // Index active status for quick filtering
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetCode: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      index: true, // Index for expiration queries
    },
    passwordResetVerified: {
      type: Boolean,
    },
    verifyEmail: {
      type: Boolean,
      default: false,
      index: true, // Index to quickly find verified/unverified users
    },
    googleId: {
      type: String,
      index: true, // Indexing for quick lookup with Google auth
    },
    appleId: {
      type: String,
      index: true, // Indexing for quick lookup with Apple auth
    },
    stripeCustomerId: {
      type: String,
      index: true, // Indexing for quick lookup with Stripe integration
    },
    paymentMethod: {
      cardType: {
        type: String,
        enum: ["visa", "stripe"],
        index: true, // Index for filtering by card type
      },
      token: String,
    },
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
