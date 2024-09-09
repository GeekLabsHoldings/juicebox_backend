const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const createToken = require('../utils/createToken');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError');
const factory = require('../utils/handlersFactory');
const { catchError } = require('../middlewares/catchErrorMiddleware');
// const cloudinary = require("cloudinary").v2;
// const { formatImage } = require("../middlewares/uploadImageMiddleware");
const { formatPhoneNumber } = require('../helpers/phoneNumber');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3 } = require('../config/awsConfig');
const {
  checkServiceOwnership,
  findNotification,
} = require('../helpers/notificationHelper');
const ApiResponse = require('../utils/apiRespones');

// @desc    Get specific user by id
// @route   GET /api/v1/users/:id
// @access  Private/Admin
exports.getUser = factory.getOne(User);

// @desc    Get Logged user data
// @route   GET /api/v1/users/getMe
// @access  Private/Protect
exports.getLoggedUserData = catchError(
  asyncHandler(async (req, res, next) => {
    req.params.id = req.user._id;
    next();
  }),
);

// @desc    Update logged user password
// @route   PUT /api/v1/users/updateMyPassword
// @access  Private/Protect
exports.updateLoggedUserPassword = catchError(
  asyncHandler(async (req, res, next) => {
    // 1) Update user password based user payload (req.user._id)
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        password: await bcrypt.hash(req.body.password, 12),
        passwordChangedAt: Date.now(),
      },
      {
        new: true,
      },
    );

    // 2) Generate token
    const token = createToken(user._id);

    const response = new ApiResponse(200, { token });
    res.status(response.statusCode).json(response);
  }),
);

// @desc    Update logged user data (excluding password, role)
// @route   PUT /api/v1/users/updateMe
// @access  Private/Protect
exports.updateLoggedUserData = catchError(async (req, res, next) => {
  const newUser = { ...req.body };
  delete newUser.password;
  delete newUser.role;

  // Validate and format phone number if provided
  if (newUser.ISD && newUser.phoneNumber) {
    newUser.phoneNumber = formatPhoneNumber(newUser.ISD, newUser.phoneNumber);
  }

  // Upload avatar to S3 if a new file is provided
  if (req.file) {
    const fileLocation = req.file.location; // S3 file URL
    newUser.avatar = fileLocation;

    // Remove old avatar from S3 if it exists
    if (req.user.avatarPublicId) {
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: req.user.avatarPublicId, // Assuming avatarPublicId is the S3 key
      };
      await s3.send(new DeleteObjectCommand(deleteParams));
    }

    newUser.avatarPublicId = req.file.key; // Store the S3 key for future deletions
  }

  // Update the user in the database
  const updatedUser = await User.findByIdAndUpdate(req.user._id, newUser, {
    new: true,
    runValidators: true,
  });

  const response = new ApiResponse(200, updatedUser);
  res.status(response.statusCode).json(response);
});

// exports.updateLoggedUserData = catchError(
//   asyncHandler(async (req, res, next) => {
//     // 1. Filter out fields that shouldn't be updated
//     const newUser = { ...req.body };
//     delete newUser.password;
//     delete newUser.role;

//     // Validate and format phone number
//     if (newUser.ISD && newUser.phoneNumber) {
//       newUser.phoneNumber = formatPhoneNumber(newUser.ISD, newUser.phoneNumber);
//     }

//     let updatedUser;
//     if (req.file) {
//       const file = formatImage(req.file);

//       // Upload new avatar image
//       const response = await cloudinary.uploader.upload(file);

//       newUser.avatar = response.secure_url;
//       newUser.avatarPublicId = response.public_id;

//       // Remove old avatar if it exists
//       if (req.user.avatarPublicId) {
//         await cloudinary.uploader.destroy(req.user.avatarPublicId);
//       }
//     }

//     // 2. Update the user document
//     updatedUser = await User.findByIdAndUpdate(req.user._id, newUser, {
//       new: true, // Return the updated document
//       runValidators: true, // Validate the update operation against the schema
//     });

//     // 3. Send the updated user data in the response
//     res.status(200).json({ data: updatedUser });
//   })
// );

// @desc    Deactivate logged user
// @route   DELETE /api/v1/users/deleteMe
// @access  Private/Protect
exports.deleteLoggedUserData = catchError(
  asyncHandler(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user._id, { active: false });

    const response = new ApiResponse(204, null, 'User deactivated');
    res.status(response.statusCode).json(response);
  }),
);

// seen notification
exports.seenNotification = catchError(
  asyncHandler(async (req, res, next) => {
    const { notificationId } = req.body;
    const userId = req.user._id;

    await checkServiceOwnership(userId);

    const user = await User.findById(userId);

    // Check if it's marked as seen already
    if (findNotification(user, notificationId)?.seen) {
      return next(new ApiError('Notification already marked as seen', 400));
    }

    // Check if notification exists
    const notification = findNotification(user, notificationId);
    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    // Find the user and update the notification status
    const updatedData = await User.findOneAndUpdate(
      { _id: userId, 'notifications._id': notificationId },
      { $set: { 'notifications.$.seen': true } },
      { new: true },
    );

    const response = new ApiResponse(200, {
      message: 'Notification marked as seen',
      updatedData,
    });
    res.status(response.statusCode).json(response);
  }),
);

// delete notification
exports.deleteNotification = catchError(
  asyncHandler(async (req, res, next) => {
    const { notificationId } = req.body;
    const userId = req.user._id;

    await checkServiceOwnership(userId);

    const user = await User.findById(userId);

    // Check if notification exists
    const notification = findNotification(user, notificationId);
    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    // Find the user and pull (delete) the notification from the array
    const updatedData = await User.findByIdAndUpdate(
      userId,
      { $pull: { notifications: { _id: notificationId } } },
      { new: true },
    );

    const response = new ApiResponse(200, {
      message: 'Notification deleted',
      updatedData,
    });
    res.status(response.statusCode).json(response);
  }),
);

// get all user notifications
exports.getAllUserNotifications = catchError(
  asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    await checkServiceOwnership(userId);
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }
    const response = new ApiResponse(200, {
      notifications: user.notifications,
    });
    res.status(response.statusCode).json(response);
  }),
);
