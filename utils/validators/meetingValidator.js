const { body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validationMiddleware');
const {
  checkServiceOwnership,
  validateFutureDate,
  validateMongoId,
  validateStatus,
  checkExists,
} = require('./validators');
const Service = require('../../models/serviceModel');
const User = require('../../models/userModel');

// Get all invitees of admins (users that role is admin) data taht will be attend the meeting with user(that role is user)

// Validation for creating a meeting
exports.createMeetingValidation = [
  validateMongoId('userId', 'body'),
  body('userId').custom(async (userId) => {
    await checkExists(User, userId);
  }),

  validateMongoId('serviceId', 'body'),
  body('serviceId').custom(async (serviceId) => {
    await checkExists(Service, serviceId);
  }),

  validateFutureDate('date', 'body'),

  // Custom validation to ensure the service belongs to the user
  body('serviceId').custom(async (serviceId, { req }) => {
    await checkServiceOwnership(req.body.userId, serviceId);
  }),

  body('invitees').custom((invitees) => {
    if (!Array.isArray(invitees)) {
      throw new Error('Invitees must be an array');
    }
    return true;
  }),

  validatorMiddleware,
];

// Validation for updating a meeting
exports.updateMeetingValidation = [
  validateStatus('status', ['accepted', 'declined', 'completed'], 'body'),

  validateFutureDate('date', 'body'),

  validateMongoId('id', 'params'), 

  validatorMiddleware,
];
