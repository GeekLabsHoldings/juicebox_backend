module.exports = {
  unauthorizedService: 'This service does not belong to you for authorization',
  invalidFutureDate: 'Date must be in the future',
  resourceNotFound: 'Resource not found',
  invalidMongoId: (fieldName) => `${fieldName} must be a valid MongoDB ObjectId`,
  // etc.
};