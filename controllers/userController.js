const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const createToken = require('../utils/createToken');
const User = require('../models/userModel');
const factory = require('../utils/handlersFactory');
const { catchError } = require('../middlewares/catchErrorMiddleware')
const cloudinary = require('cloudinary').v2;
const { formatImage } = require('../middlewares/uploadImageMiddleware');
const { formatPhoneNumber } = require('../helpers/phoneNumber');

// @desc    Get specific user by id
// @route   GET /api/v1/users/:id
// @access  Private/Admin
exports.getUser = factory.getOne(User);

// @desc    Get Logged user data
// @route   GET /api/v1/users/getMe
// @access  Private/Protect
exports.getLoggedUserData = catchError(asyncHandler(async (req, res, next) => {
  req.params.id = req.user._id;
  next();
}));

// @desc    Update logged user password
// @route   PUT /api/v1/users/updateMyPassword
// @access  Private/Protect
exports.updateLoggedUserPassword = catchError(asyncHandler(async (req, res, next) => {
  // 1) Update user password based user payload (req.user._id)
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      password: await bcrypt.hash(req.body.password, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );

  // 2) Generate token
  const token = createToken(user._id);

  res.status(200).json({ data: user, token });
}));

// @desc    Update logged user data (excluding password, role)
// @route   PUT /api/v1/users/updateMe
// @access  Private/Protect
exports.updateLoggedUserData = catchError(asyncHandler(async (req, res, next) => {
  // 1. Filter out fields that shouldn't be updated
  const newUser = { ...req.body };
  delete newUser.password;
  delete newUser.role;

  // Validate and format phone number
  if (newUser.ISD && newUser.phoneNumber) {
    newUser.phoneNumber = formatPhoneNumber(newUser.ISD, newUser.phoneNumber);
  }

  let updatedUser;
  if (req.file) {
    const file = formatImage(req.file);
    
    // Upload new avatar image
    const response = await cloudinary.uploader.upload(file);
    
    newUser.avatar = response.secure_url;
    newUser.avatarPublicId = response.public_id;

    // Remove old avatar if it exists
    if (req.user.avatarPublicId) {
      await cloudinary.uploader.destroy(req.user.avatarPublicId);
    }
  }

  // 2. Update the user document
  updatedUser = await User.findByIdAndUpdate(req.user._id, newUser, {
    new: true,  // Return the updated document
    runValidators: true,  // Validate the update operation against the schema
  });

  // 3. Send the updated user data in the response
  res.status(200).json({ data: updatedUser });
}));

// @desc    Deactivate logged user
// @route   DELETE /api/v1/users/deleteMe
// @access  Private/Protect
exports.deleteLoggedUserData = catchError(asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });

  res.status(204).json({ status: 'Success' });
}));
