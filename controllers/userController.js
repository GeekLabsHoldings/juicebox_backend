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
exports.getLoggedUserData = asyncHandler(async (req, res, next) => {
  req.params.id = req.user._id;
  next();
});

// @desc    Update logged user password
// @route   PUT /api/v1/users/updateMyPassword
// @access  Private/Protect
exports.updateLoggedUserPassword = catchError(
  asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    // 1) Find the user based on the ID stored in the token (req.user._id)
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // 2) Check if the current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return next(new ApiError('Incorrect password', 400));
    }

    // 3) If correct, hash the new password
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = Date.now();

    // 4) Save the updated user
    await user.save();

    // 5) Generate a new token
    const token = createToken(user._id);

    res
      .status(200)
      .json(new ApiResponse(200, { token }, 'Password updated successfully'));
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
    if (req.user.s3Key) {
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: req.user.s3Key, // Assuming s3Key is the S3 key
      };
      await s3.send(new DeleteObjectCommand(deleteParams));
    }

    newUser.s3Key = req.file.key; // Store the S3 key for future deletions
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

    const user = await User.findById(userId).populate(
      'notifications.serviceId',
    );
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
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          servicesWithProgress,
          'All Services for User retrieved',
        ),
      );
  }),
);

// Get all meetings
exports.getAllMeetingsForUser = catchError(
  asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const meetings = await Meeting.find({ userId })
      .sort({ createdAt: -1 })
      .populate('serviceId');
    res.status(200).json(new ApiResponse(200, meetings, 'Meetings retrieved'));
  }),
);

// get process for service
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

// get all porcess for user
exports.getAllServicesProcess = catchError(
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Find all services for the user
    const services = await Service.find({ userId });

    if (!services.length) {
      return res.status(404).json(new ApiError('No services found', 404));
    }

    // Find processes related to the retrieved services
    const serviceIds = services.map((service) => service._id);
    const processes = await Process.find({ serviceId: { $in: serviceIds } });

    // Group processes by serviceId
    const groupedProcesses = services.map((service) => ({
      service,
      processes: processes.filter((process) =>
        process.serviceId.equals(service._id),
      ),
    }));

    // Filter out services that have no processes
    const filteredGroupedProcesses = groupedProcesses.filter(
      (group) => group.processes.length > 0,
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          filteredGroupedProcesses,
          'Processes retrieved successfully.',
        ),
      );
  }),
);

// Delete all notifications that have seen is true
exports.deleteAllSeenNotifications = catchError(
  asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError('User not found', 404);
    }

    // Remove all seen notifications
    await user.updateOne({
      $pull: {
        notifications: { seen: true },
      },
    });

    // Fetch the updated user data to get the latest notifications
    const updatedUser = await User.findById(userId);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedUser.notifications,
          'All seen notifications deleted',
        ),
      );
  }),
);

// Get Invitees for a Meeting
exports.getInvitees = catchError(
  asyncHandler(async (req, res, next) => {
    const { meetingId } = req.params;

    // Find the meeting
    const meeting = await Meeting.findById(meetingId).populate('inviteesId');

    if (!meeting) {
      return next(new ApiError('Meeting not found', 404));
    }

    // Filter invitees who are admins
    const invitees = meeting.inviteesId.filter(
      (invitee) => invitee.role === 'admin',
    );

    res.status(200).json({
      status: 'success',
      data: {
        invitees,
      },
    });
  }),
);
