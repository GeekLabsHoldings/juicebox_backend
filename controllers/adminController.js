const asyncHandler = require("express-async-handler");
const { catchError } = require("../middlewares/catchErrorMiddleware");
const Service = require("../models/serviceModel");
const User = require("../models/userModel");
const ApiError = require("../utils/apiError");
const Vacancy = require("../models/vacanciesModel");
const Career = require("../models/careersModel");

// Get all services that are call-sales
const getAllCallSalesServices = catchError(
  asyncHandler(async (req, res) => {
    const services = await Service.find({ status: "call-sales" });

    res.status(200).json({
      success: true,
      services,
    });
  })
);

// Get all users
const getAllUsers = catchError(
  asyncHandler(async (req, res) => {
    const users = await User.find();

    res.status(200).json({
      success: true,
      users,
    });
  })
);

// Get all user notifications
const getAllUserNotifications = catchError(
  asyncHandler(async (req, res) => {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError("User not found", 404);
    }
    res.status(200).json({
      success: true,
      notifications: user.notifications,
    });
  })
);

// Notification to a user by when a service is completed
const notifyUser = catchError(
  asyncHandler(async (req, res) => {
    const { userId, serviceId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      throw new ApiError("Service not found", 404);
    }

    if (service.status !== "completed") {
      throw new ApiError("Service is not completed", 400);
    }

    user.notifications.push({
      serviceId: service._id,
      seen: false,
    });

    await user.save();

    res.status(200).json({
      success: true,
    });
  })
);

// seen notification
const seenNotification = catchError(
  asyncHandler(async (req, res) => {
    const { notificationId } = req.body;

    const user = await User.findById(notificationId);

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    user.notifications = user.notifications.map((notification) => {
      if (notification.serviceId === notificationId) {
        notification.seen = true;
      }
      return notification;
    });

    await user.save();

    res.status(200).json({
      success: true,
    });
  })
);

// delete notification
const deleteNotification = catchError(
  asyncHandler(async (req, res) => {
    const { notificationId } = req.body;

    const user = await User.findById(notificationId);

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    user.notifications = user.notifications.filter(
      (notification) => notification.serviceId !== notificationId
    );

    await user.save();

    res.status(200).json({
      success: true,
    });
  })
);

// delete a service
const deleteService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId } = req.body;

    // Fetch the service by ID
    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError("Service not found", 404);
    }

    await Service.findByIdAndDelete(serviceId);

    res.status(200).json({
      success: true,
    });
  })
);

// delete a user
const deleteUser = catchError(
  asyncHandler(async (req, res) => {
    const { userId } = req.body;

    // Fetch the user by ID
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
    });
  })
);

// get all services for a user
const getAllServicesForUser = catchError(
  asyncHandler(async (req, res) => {
    const { userId } = req.body;

    const services = await Service.find({ userId });

    res.status(200).json({
      success: true,
      services,
    });
  })
);

// Update a service when status is call-sales
const updateService = catchError(
  asyncHandler(async (req, res) => {
    const { serviceId, updates } = req.body;

    // Fetch the service by ID
    const service = await Service.findById(serviceId);

    if (!service) {
      throw new ApiError("Service not found", 404);
    }

    // check if status is call-sales
    if (service.status !== "call-sales") {
      throw new ApiError("Service status is not call-sales", 400);
    }

    // Update the service and status to completed
    const updatedService = await Service.findByIdAndUpdate(
      serviceId,
      {
        ...updates,
        status: "completed",
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      service: updatedService,
    });
  })
);

// Add new vacancy
const addNewVacancy = catchError(
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      benefits,
      requirements,
      responsibilities,
      status,
    } = req.body;

    const newVacancy = new Vacancy({
      title,
      description,
      benefits,
      requirements,
      responsibilities,
      status,
    });

    await newVacancy.save();

    res.status(200).json({
      success: true,
      newVacancy,
    });
  })
);

// Update vacancy
const updateVacancy = catchError(
  asyncHandler(async (req, res) => {
    const { vacancyId, updates } = req.body;

    // Fetch the service by ID
    const vacancy = await Vacancy.findById(vacancyId);

    if (!vacancy) {
      throw new ApiError("Vacancy not found", 404);
    }

    // Update the service and status to completed
    const updatedVacancy = await Vacancy.findByIdAndUpdate(
      vacancyId,
      {
        ...updates,
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      vacancy: updatedVacancy,
    });
  })
);

// delete vacancy
const deleteVacancy = catchError(
  asyncHandler(async (req, res) => {
    const { vacancyId } = req.body;

    // Fetch the service by ID
    const vacancy = await Vacancy.findById(vacancyId);

    if (!vacancy) {
      throw new ApiError("Vacancy not found", 404);
    }

    await Vacancy.findByIdAndDelete(vacancyId);

    res.status(200).json({
      success: true,
    });
  })
);

// get all careers for vacancy by id
const getAllCareersForVacancy = catchError(
  asyncHandler(async (req, res) => {
    const { vacancyId } = req.body;

    const careers = await Career.find({ vacancyId });

    res.status(200).json({
      success: true,
      careers,
    });
  })
);

module.exports = {
  getAllCallSalesServices,
  getAllUsers,
  updateService,
  getAllServicesForUser,
  notifyUser,
  seenNotification,
  getAllUserNotifications,
  deleteNotification,
  deleteService,
  deleteUser,
  addNewVacancy,
  updateVacancy,
  deleteVacancy,
  getAllCareersForVacancy,
};
