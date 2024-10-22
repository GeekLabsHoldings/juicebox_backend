const asyncHandler = require("express-async-handler");
const { catchError } = require("../middlewares/catchErrorMiddleware");
const Vacancy = require("../models/vacanciesModel");
const Career = require("../models/careersModel");
const ApiError = require("../utils/apiError");
const ApiResponse = require('../utils/apiResponse');

// Get all vacancies
exports.getAllVacancies = catchError(
  asyncHandler(async (req, res) => {
    const vacancies = await Vacancy.find({ status: { $ne: 'closed' } });
    
    res
      .status(200)
      .json(
        new ApiResponse(200, vacancies, 'Vacancies retrieved successfully'),
      );
  }),
);

// Post a new career job
exports.postCareer = catchError(
  asyncHandler(async (req, res) => {
    const {
      vacancyId,
      name,
      email,
      linkedInLink,
      portfolioLink,
      phoneNumber,
    } = req.body;

    // Validate vacancy
    const vacancy = await Vacancy.findById(vacancyId);
    if (!vacancy) {
      throw new ApiError('Vacancy not found', 404);
    }

    // Check if the vacancy is closed
    if (vacancy.status === 'closed') {
      throw new ApiError('Cannot apply for a closed vacancy', 400);
    }

    // Create new career entry
    const newCareer = new Career({
      name,
      vacancyId,
      email,
      phoneNumber,
      cv: req.file ? req.file.location : undefined, // This will be the S3 URL
      portfolioLink,
      linkedInLink,
    });

    try {
      await newCareer.save();

      res.status(201).json(new ApiResponse(201, newCareer, 'Career created'));
    } catch (error) {
      throw new ApiError('Failed to save career entry', 500);
    }
  }),
);
