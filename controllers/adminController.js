const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const Service = require('../models/serviceModel');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const Process = require('../models/serviceProcessModel');
const Vacancy = require('../models/vacanciesModel');
const Career = require('../models/careersModel');
const Meeting = require('../models/meetingModel');
const { ObjectId } = require('mongoose').Types;
const factory = require('../utils/handlersFactory');

// Get all services that are call-sales
exports.getAllCallSalesServices = catchError(
  asyncHandler(async (req, res) => {
    const services = await Service.find({ status: 'call-sales' });

    res.status(200).json({
      success: true,
      services,
    });
  }),
);

// Get all users
exports.getAllUsers = catchError(
  asyncHandler(async (req, res) => {
    const users = await User.find();

    res.status(200).json(new ApiResponse(200, users, 'Users retrieved'));
  }),
);

// Notification to a user by when a service is completed
exports.notifyUser = catchError(
  asyncHandler(async (req, res) => {
    const { userId, serviceId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError('User not found', 404);
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      throw new ApiError('Service not found', 404);
    }

    // check this service belons to this user
    if (!service.userId.equals(user._id)) {
      throw new ApiError('Service does not belong to this user', 400);
    }

    if (service.status !== 'completed') {
      throw new ApiError('Service is not completed', 400);
    }

    user.notifications.push({
      serviceId: service._id,
      seen: false,
    });

    await user.save();

    res.status(200).json(new ApiResponse(200, user, 'User notified'));
  }),
);

// delete a service
exports.deleteService = catchError(
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Fetch the service by ID
    const service = await Service.findById(id);

    if (!service) {
      throw new ApiError('Service not found', 404);
    }

    await Service.findByIdAndDelete(id);

    res.status(204).json(new ApiResponse(204, service, 'Service deleted'));
  }),
);

// delete a user
exports.deleteUser = catchError(
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Fetch the user by ID
    const user = await User.findById(id);

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    await User.findByIdAndDelete(id);

    res.status(204).json(new ApiResponse(204, user, 'User deleted'));
  }),
);

// Update a service when status is call-sales
exports.updateService = catchError(
  asyncHandler(async (req, res) => {
    const { id } = req.params; 
    const updates = req.body;

    // Fetch the service by ID
    const service = await Service.findById(id);

    if (!service) {
      throw new ApiError('Service not found', 404);
    }

    // check if status is call-sales
    if (service.status !== 'call-sales') {
      throw new ApiError('Service status is not call-sales', 400);
    }

    // Update the service and status to completed
    const updatedService = await Service.findByIdAndUpdate(
      id,
      {
        ...updates,
        status: 'completed',
      },
      { new: true },
    );

    res
      .status(200)
      .json(new ApiResponse(200, updatedService, 'Service updated'));
  }),
);

// Add new vacancy
exports.addNewVacancy = catchError(
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

    res.status(201).json(new ApiResponse(201, newVacancy, 'Vacancy created'));
  }),
);

// Update vacancy
exports.updateVacancy = catchError(
  asyncHandler(async (req, res) => {
    const { id } = req.params; 
    const updates = req.body;

    // Fetch the vacancy by ID
    const vacancy = await Vacancy.findById(id);

    if (!vacancy) {
      throw new ApiError('Vacancy not found', 404);
    }

    // Update the vacancy
    const updatedVacancy = await Vacancy.findByIdAndUpdate(
      id,
      { ...updates },
      { new: true },
    );

    res
      .status(200)
      .json(new ApiResponse(200, updatedVacancy, 'Vacancy updated'));
  }),
);

// delete vacancy
exports.deleteVacancy = catchError(
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Fetch the service by ID
    const vacancy = await Vacancy.findById(id);

    if (!vacancy) {
      throw new ApiError('Vacancy not found', 404);
    }

    await Vacancy.findByIdAndDelete(id);

    res.status(204).json(new ApiResponse(204, vacancy, 'Vacancy deleted'));
  }),
);

// get all careers for vacancy by id
exports.getAllCareersForVacancy = catchError(
  asyncHandler(async (req, res) => {
    const { vacancyId } = req.body;

    const careers = await Career.find({ vacancyId });

    res.status(200).json(new ApiResponse(200, careers, 'Careers retrieved'));
  }),
);

// Create a new process service
exports.makeProcessService = catchError(
  asyncHandler(async (req, res, next) => {
    const { serviceId, options } = req.body;

    // Find the service by ID
    const service = await Service.findById(serviceId);

    // Check if the necessary data is provided
    if (!service || !options) {
      return next(new ApiError('Service ID and options are required', 400));
    }

    // Check if the service is not purchased
    if (service.status !== 'purchased') {
      return next(new ApiError('Service is not purchased', 400));
    }

    // Check if a process service already exists for this service
    const existingProcess = await Process.findOne({ serviceId });
    if (existingProcess) {
      return next(new ApiError('A process service already exists for this service', 400));
    }

    // Create a new process service
    const processService = await Process.create({
      serviceId,
      options,
    });

    // Send the response back to the client
    res
      .status(201)
      .json(
        new ApiResponse(
          200,
          processService,
          'Process service created successfully',
        ),
      );
  }),
);

exports.updateProcessService = catchError(
  asyncHandler(async (req, res, next) => {
    const { id } = req.params; // ID of the process service
    const { optionId } = req.body; // ID of the option to update

    // Find the process service by ID
    const processService = await Process.findById(id);

    if (!processService) {
      return next(new ApiError('Process service not found', 404));
    }

    // Check if the process service is already completed
    if (processService.status === 'completed') {
      return next(
        new ApiError('Cannot update a completed process service', 400),
      );
    }

    // Find the specific option by its ID and update the 'done' status to true
    const option = processService.options.id(optionId);
    if (!option) {
      return next(new ApiError('Option not found', 404));
    }

    option.done = true;

    // Save the updated process service (pre-save middleware will handle the progress and status)
    await processService.save();

    // Send the updated process service back to the client
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          processService,
          'Process service updated successfully',
        ),
      );
  }),
);

// Create a new meeting
exports.createMeeting = catchError(
  asyncHandler(async (req, res, next) => {
    const { userId, serviceId, date } = req.body;

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Check if the service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return next(new ApiError('Service not found', 404));
    }

    // Check if the service is belones to the user
    if (!service.userId.equals(userId)) {
      return next(new ApiError('Service does not belong to the user', 400));
    }

    // Validate input
    if (!serviceId || !date || !userId) {
      return next(
        new ApiError('Service ID, userId and meeting date are required', 400),
      );
    }

    // Check if the date is in the future
    if (new Date(date) < new Date()) {
      return next(new ApiError('Meeting date must be in the future', 400));
    }

    // Create a new meeting
    const meeting = await Meeting.create({
      userId,
      serviceId,
      date,
    });

    // Send the response back to the client
    res
      .status(201)
      .json(new ApiResponse(201, meeting, 'Meeting created successfully'));
  }),
);

// Main updateMeeting function
exports.updateMeeting = factory.updateOne(Meeting);

// Delete a meeting
exports.deleteMeeting = factory.deleteOne(Meeting);
