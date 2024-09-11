const Service = require('../../models/serviceModel');
const ApiError = require('../../utils/apiError');
const { param, body } = require('express-validator');

// Check service belongs to the user
const checkServiceOwnership = async (userId) => {
  const service = await Service.findOne({ userId });
  if (!service || !service.userId.equals(userId)) {
    throw new ApiError(
      'This service does not belong to you for authorization',
      403,
    );
  }
};

// check if date is in the future
const validateFutureDate = (fieldName) =>
  body(fieldName)
    .isISO8601()
    .withMessage(`${fieldName} must be a valid date format (ISO 8601)`)
    .custom((value) => {
      const inputDate = new Date(value);
      if (inputDate <= new Date()) {
        throw new ApiError('Date must be in the future', 400);
      }
      return true;
    });

// Check if an item exists in the database
const checkExists = async (model, id) => {
  const exists = await model.exists({ _id: id });
  if (!exists) {
    throw new ApiError('Resource not found', 404);
  }
};

// validate mongo id
const validateMongoId = (paramName) =>
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} must be a valid MongoDB ObjectId`);


// check birth date is not in the future
const checkBirthDate = (fieldName) =>
  body(fieldName)
    .isISO8601()
    .withMessage(`${fieldName} must be a valid date format (ISO 8601)`)
    .custom((value) => {
      const inputDate = new Date(value);
      if (inputDate > new Date()) {
        throw new ApiError('Date must be in the past', 400);
      }
      return true;
    });

module.exports = {
  checkServiceOwnership,
  validateFutureDate,
  checkExists,
  validateMongoId,
  checkBirthDate,
};
