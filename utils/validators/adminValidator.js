const { body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validationMiddleware');
const {
  checkExists,
  validateMongoId,
  checkStatus,
  checkArrayField,
} = require('./validators');
const Service = require('../../models/serviceModel');
const Process = require('../../models/serviceProcessModel');

// Validation for creating a process of a service
exports.createProcessValidation = [
  validateMongoId('serviceId', 'body'),
  body('serviceId').custom(async (serviceId) => {
    await checkExists(Service, serviceId);
    await checkExists(Process, serviceId);
    await checkStatus(Service, serviceId, 'purchased', '!==');
  }),

  checkArrayField('options', 'body'),

  validatorMiddleware,
];
