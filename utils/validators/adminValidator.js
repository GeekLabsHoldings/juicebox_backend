const { param, body } = require('express-validator');
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
  }),

  body('serviceId').custom(async (serviceId) => {
    await checkStatus(Service, serviceId, 'purchased', '!==');
  }),

  body('serviceId').custom(async (serviceId) => {
    await checkExists(Process, serviceId);
  }),

  checkArrayField('options', 'body'),

  validatorMiddleware,
];

// Validation for updating a process of a service
exports.updateProcessValidation = [
  validateMongoId('id', 'params'),
  param('id').custom(async (id) => {
    await checkExists(Process, id);
  }),

  param('id').custom(async (id) => {
    await checkStatus(Process, id, 'completed', '===');
  }),

  checkArrayField('options', 'body'),
  validatorMiddleware,
];
