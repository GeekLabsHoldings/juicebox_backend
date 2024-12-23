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
const Blog = require('../models/blogModel');
const factory = require('../utils/handlersFactory');
const {
  unblockIP,
  unblockUserById,
  getIpFromRequest,
} = require('../helpers/botDetectionHelper');

// Get all services that are call-sales
exports.getAllCallSalesServices = catchError(
  asyncHandler(async (req, res) => {
    const services = await Service.find({ status: 'call-sales' });

    res.status(200).json(new ApiResponse(200, services, 'Services retrieved'));
  }),
);

// Get all users
exports.getAllUsers = factory.getAll(User);

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

    // check if user has already been notified for this service
    if (user.notifications.some((n) => n.serviceId.equals(service._id))) {
      throw new ApiError(
        'User has already been notified for this service',
        400,
      );
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
exports.deleteService = factory.deleteOne(Service);

// delete a user
exports.deleteUser = factory.deleteOne(User);

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
exports.addNewVacancy = factory.createOne(Vacancy);

// Update vacancy
exports.updateVacancy = factory.updateOne(Vacancy);

// delete vacancy
exports.deleteVacancy = factory.deleteOne(Vacancy);

// get all careers for vacancy by id
exports.getAllCareersForVacancy = catchError(
  asyncHandler(async (req, res) => {
    const { vacancyId } = req.body;

    const careers = await Career.find({ vacancyId });

    res.status(200).json(new ApiResponse(200, careers, 'Careers retrieved'));
  }),
);

// delete all careers that status is rejected
exports.deleteAllRejectedCareers = catchError(
  asyncHandler(async (req, res, next) => {
    const careers = await Career.find({ status: 'rejected' });

    if (careers.length === 0) {
      return next(new ApiError('No careers found', 404));
    }

    const result = await Career.deleteMany({ status: 'rejected' });

    res.status(204).json(new ApiResponse(204, result, 'Careers deleted'));
  }),
);

// Create a new process service
exports.makeProcessService = factory.createOne(Process);
// exports.makeProcessService = catchError(
//   asyncHandler(async (req, res, next) => {
//     const { serviceId, options } = req.body;

//     // Find the service by ID
//     const service = await Service.findById(serviceId);

//     // Check if the necessary data is provided
//     if (!service || !options) {
//       return next(new ApiError('Service ID and options are required', 400));
//     }

//     // Check if the service is not purchased
//     if (service.status !== 'purchased') {
//       return next(new ApiError('Service is not purchased', 400));
//     }

//     // Check if a process service already exists for this service
//     const existingProcess = await Process.findOne({ serviceId });
//     if (existingProcess) {
//       return next(new ApiError('A process service already exists for this service', 400));
//     }

//     // Create a new process service
//     const processService = await Process.create({
//       serviceId,
//       options,
//     });

//     // Send the response back to the client
//     res
//       .status(201)
//       .json(
//         new ApiResponse(
//           200,
//           processService,
//           'Process service created successfully',
//         ),
//       );
//   }),
// );

// Update a process service
exports.updateProcessService = factory.updateOne(Process);

exports.updateProcessServiceOption = catchError(
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
exports.createMeeting = factory.createOne(Meeting);

// Main updateMeeting function
exports.updateMeeting = factory.updateOne(Meeting);

// Delete a meeting
exports.deleteMeeting = factory.deleteOne(Meeting);

// Create a new blog
exports.createBlog = factory.createOne(Blog);

// Main updateBlog function
exports.updateBlog = factory.updateOne(Blog);

// Delete a blog
exports.deleteBlog = factory.deleteOne(Blog);

// Controller: Unblock User or IP
exports.unblockUser = catchError(
  asyncHandler(async (req, res) => {
    const { userId } = req.body;
    const ip = getIpFromRequest(req);

    if (!userId && !ip) {
      return res
        .status(400)
        .json({
          message:
            'Provide either a userId or ensure the request IP is available.',
        });
    }

    try {
      let message;

      if (ip) {
        // Unblock by IP
        message = await unblockIP(ip);
      } else if (userId) {
        // Unblock by User ID
        message = await unblockUserById(userId);
      }

      return res.status(200).json({ message });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }),
);

// Controller: Get Request IP
exports.getIp = catchError(
  asyncHandler(async (req, res) => {
    const ip = getIpFromRequest(req);
    res.status(200).json({ ip });
  }),
);
