const { body, param } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validationMiddleware');

exports.updateMeetingValidation = [
  body('status')
    .isIn(['accepted', 'declined', 'completed'])
    .withMessage('Meeting status must be accepted, declined or completed'),

  body('date')
    .isISO8601()
    .withMessage('Date must be a valid date format (ISO 8601)'),

  param('id')
    .isMongoId()
    .withMessage('Meeting ID must be a valid MongoDB ObjectId'),

  validatorMiddleware,
];
