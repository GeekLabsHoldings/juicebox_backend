const asyncHandler = require("express-async-handler");
const { catchError } = require("../middlewares/catchErrorMiddleware");
const Vacancy = require("../models/vacanciesModel");
const Career = require("../models/careersModel");
const ApiError = require("../utils/apiError");
const capitalizeFirstLetter = require("../helpers/capitalizeFirstLetter");
const fs = require("fs");
const path = require("path");

// Utility function to unlink a file
const unlinkFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Failed to delete file ${filePath}:`, err);
    }
  });
};

// Get all vacancies 
const getAllVacancies = catchError(
  asyncHandler(async (req, res) => {
    const vacancies = await Vacancy.find({ status: { $ne: "closed" } });
    res.status(200).json({
      success: true,
      vacancies,
    });
  })
);

// Post a new career job
const postCareer = catchError(
  asyncHandler(async (req, res) => {
    const {
      vacancyId,
      firstName,
      lastName,
      email,
      linkedInLink,
      portfolioLink,
      phoneNumber,
    } = req.body;

    // Validate vacancy
    const vacancy = await Vacancy.findById(vacancyId);
    if (!vacancy) {
      if (req.file && req.file.path) {
        // Delete the file if it exists
        unlinkFile(req.file.path);
      }
      throw new ApiError("Vacancy not found", 404);
    }

    // Check if the vacancy is closed
    if (vacancy.status === "closed") {
      if (req.file && req.file.path) {
        // Delete the file if it exists
        unlinkFile(req.file.path);
      }
      throw new ApiError("Cannot apply for a closed vacancy", 400);
    }

    // Capitalize names
    const formattedFirstName = capitalizeFirstLetter(firstName);
    const formattedLastName = capitalizeFirstLetter(lastName);
    const fullName = `${formattedFirstName} ${formattedLastName}`;

    // Create new career entry
    const newCareer = new Career({
      name: fullName,
      vacancyId,
      email,
      phoneNumber,
      cv: req.file ? req.file.path : undefined, // This will be set by the upload middleware in the routes file
      portfolioLink,
      linkedInLink,
    });

    try {
      await newCareer.save();
      res.status(200).json({
        success: true,
        career: newCareer,
      });
    } catch (error) {
      // If saving the career fails, delete the uploaded CV file if it exists
      if (req.file && req.file.path) {
        unlinkFile(req.file.path);
      }
      throw new ApiError("Failed to save career entry", 500);
    }
  })
);

module.exports = {
  postCareer,
  getAllVacancies,
};
