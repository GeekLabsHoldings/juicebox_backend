module.exports = {
  unauthorizedService: 'This service does not belong to you for authorization',
  invalidFutureDate: 'Date must be in the future',
  documentNotFound: (id) => `No document found for this ID: ${id}`,
  invalidStatus: (document, id, status) => `The ${document} with ID: ${id} has a status: ${status} it's not suitable for this action`,
  invalidMongoId: (fieldName) => `${fieldName} must be a valid MongoDB ObjectId`,
  // etc.
};