const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const createToken = require('../utils/createToken');
const User = require('../models/userModel');
const Service = require('../models/serviceModel');
const Meeting = require('../models/meetingModel');
const Process = require('../models/serviceProcessModel');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const factory = require('../utils/handlersFactory');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const { formatPhoneNumber } = require('../helpers/phoneNumber');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3 } = require('../config/awsConfig');
const {
  checkServiceOwnership,
  findNotification,
} = require('../helpers/notificationHelper');

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

    res.status(200).json(new ApiResponse(200, { token }, 'Password updated'));
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

  res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'User updated'));
});

// @desc    Deactivate logged user
// @route   DELETE /api/v1/users/deleteMe
// @access  Private/Protect
exports.deleteLoggedUserData = catchError(
  asyncHandler(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user._id, { active: false });

    res.status(200).json(new ApiResponse(200, null, 'User deactivated'));
  }),
);

// seen notification
exports.seenNotification = catchError(
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user._id;

    await checkServiceOwnership(userId);

    const user = await User.findById(userId);

    // Check if it's marked as seen already
    if (findNotification(user.notifications, id)?.seen) {
      return next(new ApiError('Notification already marked as seen', 400));
    }

    // Check if notification exists
    const notification = findNotification(user.notifications, id);
    
    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    // Find the user and update the notification status
    const updatedData = await User.findOneAndUpdate(
      { _id: userId, 'notifications._id': id },
      { $set: { 'notifications.$.seen': true } },
      { new: true },
    );

    res
      .status(200)
      .json(new ApiResponse(200, updatedData, 'Notification marked as seen'));
  }),
);

// delete notification
exports.deleteNotification = catchError(
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user._id;

    await checkServiceOwnership(userId);

    const user = await User.findById(userId);

    // Check if notification exists
    const notification = findNotification(user.notifications, id);

    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    // Find the user and pull (delete) the notification from the array
    const updatedData = await User.findByIdAndUpdate(
      userId,
      { $pull: { notifications: { _id: id } } },
      { new: true },
    );

    res
      .status(200)
      .json(new ApiResponse(200, updatedData, 'Notification deleted'));
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

    res
      .status(200)
      .json(new ApiResponse(200, user.notifications, 'Notifications'));
  }),
);

// get all services for user
exports.getAllServicesForUser = catchError(
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Find all services for the user
    const services = await Service.find({ userId });

    // Map to hold promises for fetching process progress for each service
    const servicesWithProgressPromises = services.map(async (service) => {
      // Find the associated process for the service
      const process = await Process.findOne({ serviceId: service._id });

      return {
        service,
        totalProgressPercentage: process ? process.totalProgressPercentage : 0,
      };
    });

    // Resolve all promises
    const servicesWithProgress = await Promise.all(
      servicesWithProgressPromises,
    );

    // Send the response with services and their progress
    res.status(200).json(new ApiResponse(200, servicesWithProgress, 'All Services for User retrieved'));
  }),
);

// Get all meetings when status is accepted for the authenticated user
exports.getAllMeetingsForUser = catchError(
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Find all meetings for the user
    const meetings = await Meeting.find({
      userId,
      status: { $ne: 'accepted' },
    }).populate('serviceId', 'type'); // Optional: populate serviceId to get service details

    res.status(200).json(new ApiResponse(200, meetings, 'All Meetings for User retrieved'));
  }),
);

// get all process for service
exports.getProcessForService = catchError(
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const service = await Service.findById(id);
    if (!service) {
      throw new ApiError('Service not found', 404);
    }

    const process = await Process.findOne({ serviceId: service._id });
    if (!process) {
      throw new ApiError('Process not found', 404);
    }

    res.status(200).json(new ApiResponse(200, process, 'Process retrieved'));
  }),
);
