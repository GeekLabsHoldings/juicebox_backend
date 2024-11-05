const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const { sendEmail } = require('../utils/sendEmail');
const { verifyEmailTemplate } = require('../template/verifyEmail');
const { passwordResetTemplate } = require('../template/passwordReset');
const createToken = require('../utils/createToken');
const { formatPhoneNumber } = require('../helpers/phoneNumber');
const capitalizeFirstLetter = require('../helpers/capitalizeFirstLetter');

// helper function for set cookie
const setCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict', // or 'Lax' depending on your app’s needs
    maxAge: Number(process.env.JWT_COOKIE_EXPIRE_TIME) * 24 * 60 * 60 * 1000,
  });
};

exports.signUpController = catchError(
  asyncHandler(async (req, res, next) => {
    const { firstName, lastName, email, password, ISD, phoneNumber, DOB } =
      req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return next(new ApiError('Email already exists', 400));

    // Validate and format phone number
    const formattedPhoneNumber = formatPhoneNumber(ISD, phoneNumber);

    // Capitalize firstName and lastName
    const formattedFirstName = capitalizeFirstLetter(firstName);
    const formattedLastName = capitalizeFirstLetter(lastName);

    const newUser = new User({
      firstName: formattedFirstName,
      lastName: formattedLastName,
      email,
      password,
      ISD,
      phoneNumber: formattedPhoneNumber,
      DOB,
    });

    await newUser.save();

    const token = jwt.sign(
      { email: newUser.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRE_TIME },
    );

    await sendEmail(
      email,
      'Please Verify Your Email',
      verifyEmailTemplate(token),
    );

    res.status(201).json(new ApiResponse(201, newUser, 'User created successfully, please verify your email'));
  }),
);

// exports.signInController = catchError(
//   asyncHandler(async (req, res, next) => {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) return next(new ApiError("User not found", 404));

//     if (!user.verifyEmail)
//       return next(new ApiError("Please verify your email", 400));

//     const isPasswordCorrect = await bcrypt.compare(password, user.password);
//     if (!isPasswordCorrect)
//       return next(new ApiError("Invalid email or password", 401));

//     // 2- Generate token
//     const token = createToken(user);

//     res.status(200).json(new ApiResponse(200, { token }, 'User logged in successfully'));
//   })
// );

// signInController example
exports.signInController = catchError(
  asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(new ApiError('User not found', 404));

    if (!user.verifyEmail)
      return next(new ApiError('Please verify your email', 400));

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return next(new ApiError('Invalid email or password', 401));

    // Generate token
    const token = createToken(user);

    // Set the token as an HttpOnly cookie
    setCookie(res, token);

    // res.cookie("token", token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "Strict", // or 'Lax' depending on your app’s needs
    //   maxAge: Number(process.env.JWT_COOKIE_EXPIRE_TIME) * 30 * 24 * 60 * 60 * 1000,
    //   domain: ".creativejuicebox.com", // Optional: only if you're managing cookies across subdomains
    // });

    res
      .status(200)
      .json(new ApiResponse(200, {}, 'User logged in successfully'));
  }),
);

exports.verifyEmailController = catchError(
  asyncHandler(async (req, res, next) => {
    const { token } = req.params;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const user = await User.findOne({ email: decoded.email });
      if (!user) return next(new ApiError('User not found', 404));
      user.verifyEmail = true;
      await user.save();
      res.status(200).json(new ApiResponse(200, {}, 'Email verified successfully'));
    } catch (err) {
      console.error('Email verification error:', err);
      return next(new ApiError('Invalid or expired token', 400));
    }
  }),
);

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotPassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with that email ${req.body.email}`, 404),
    );
  }

  // 2) If user exists, generate and hash reset random 6-digit code, then save it in the DB
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedResetCode = crypto
    .createHash('sha256')
    .update(resetCode)
    .digest('hex');

  // Save hashed password reset code into db
  user.passwordResetCode = hashedResetCode;
  // Add expiration time for password reset code (10 min)
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  user.passwordResetVerified = false;

  await user.save();

  // 3) Send the reset code via email
  try {
    await sendEmail(
      user.email, // to
      'Your password reset code (valid for 10 min)', // subject
      passwordResetTemplate(resetCode), // htmlContent
    );
  } catch (err) {
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetVerified = undefined;

    await user.save();
    return next(new ApiError('There is an error in sending email', 500));
  }

  res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password reset code sent to email'));
});

// @desc    Verify password reset code
// @route   POST /api/v1/auth/verifyResetCode
// @access  Public
exports.verifyPassResetCode = asyncHandler(async (req, res, next) => {
  // 1) Get user based on reset code
  const hashedResetCode = crypto
    .createHash('sha256')
    .update(req.body.resetCode)
    .digest('hex');

  const user = await User.findOne({
    passwordResetCode: hashedResetCode,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ApiError('Reset code invalid or expired'));
  }

  // 2) Reset code valid
  user.passwordResetVerified = true;
  await user.save();

  res.status(200).json(new ApiResponse(200, {}, 'Reset code verified'));
});

// @desc    Reset password
// @route   POST /api/v1/auth/resetPassword
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user based on email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with email ${req.body.email}`, 404),
    );
  }

  // 2) Check if reset code verified
  if (!user.passwordResetVerified) {
    return next(new ApiError('Reset code not verified', 400));
  }

  user.password = req.body.newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetVerified = undefined;

  await user.save();

  // 3) if everything is ok, generate token
  const token = createToken(user._id);

  // Set the token as an HttpOnly cookie
  setCookie(res, token);

  res.status(200).json(new ApiResponse(200, {}, 'Password reset successfully'));
});

// @desc    Login with google
// @route   POST /api/v1/auth/google
// @access  Public
exports.googleLogin = asyncHandler(async (req, res, next) => {
  const { sub, given_name, family_name, picture, email, email_verified } =
    req.body;

  if (!email_verified) {
    return next(new ApiError('Email not verified', 400));
  }

  const user = await User.findOne({ email });

  const formattedFirstName = capitalizeFirstLetter(given_name);
  const formattedLastName = capitalizeFirstLetter(family_name);

  if (!user) {
    const newUser = await User.create({
      firstName: formattedFirstName,
      lastName: formattedLastName,
      email,
      avatar: picture,
      googleId: sub,
      verifyEmail: email_verified,
    });

    const token = createToken(newUser);

    // Set the token as an HttpOnly cookie
    setCookie(res, token);

    res
      .status(200)
      .json(new ApiResponse(200, {}, 'User signed up successfully'));
  }

  const token = createToken(user);

  // Set the token as an HttpOnly cookie
  setCookie(res, token);

  res.status(200).json(new ApiResponse(200, {}, 'User logged in successfully'));
});

// exports.googleLogin = asyncHandler(async (req, res, next) => {
//   const { sub, given_name, family_name, picture, email, email_verified } =
//     req.body;

//   if (!email_verified) {
//     return next(new ApiError('Email not verified', 400));
//   }

//   const user = await User.findOne({ email });

//   const formattedFirstName = capitalizeFirstLetter(given_name);
//   const formattedLastName = capitalizeFirstLetter(family_name);

//   if (!user) {
//     const newUser = await User.create({
//       firstName: formattedFirstName,
//       lastName: formattedLastName,
//       email,
//       avatar: picture,
//       googleId: sub,
//       verifyEmail: email_verified,
//     });

//     const token = createToken(newUser);

//     res.status(200).json({
//       message: 'User signed up successfully',
//       token,
//     });
//   }

//   const token = createToken(user);

//   res.status(200).json({
//     message: 'User logged in successfully',
//     token,
//   });
// });

exports.logoutController = (req, res) => {
  res.cookie('token', '', { maxAge: 1 });
  res
    .status(200)
    .json(new ApiResponse(200, {}, 'User logged out successfully'));
};
