const { body, check } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validationMiddleware');

exports.updateLoggedUserValidator = [
  check('email')
    .custom((value, { req }) => {
      if (req.body.email) {
        throw new Error('Email cannot be updated');
      }
      return true;
    }),

  check('password')
    .custom((value, { req }) => {
      if (req.body.password) {
        throw new Error('Password cannot be updated');
      }
      return true;
    }),

  check('role')
    .custom((value, { req }) => {
      if (req.body.role) {
        throw new Error('Role cannot be updated');
      }
      return true;
    }),

  body('firstName')
    .optional()
    .isString()
    .withMessage('First name must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters long'),

  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters long'),

  body('phoneNumber')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('country')
    .optional()
    .isString()
    .withMessage('Country must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters long'),

  body('address')
    .optional()
    .isString()
    .withMessage('Address must be a string')
    .isLength({ min: 2, max: 100 })
    .withMessage('Address must be between 2 and 100 characters long'),

  body('city')
    .optional()
    .isString()
    .withMessage('City must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters long'),

  body('org')
    .optional()
    .isString()
    .withMessage('Organization must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Organization must be between 2 and 50 characters long'),

  body('position')
    .optional()
    .isString()
    .withMessage('Position must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Position must be between 2 and 50 characters long'),

  validatorMiddleware,
];
