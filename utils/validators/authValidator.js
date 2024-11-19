const { check } = require('express-validator');
const User = require('../../models/userModel');
const validatorMiddleware = require('../../middlewares/validationMiddleware');
const {
  emailPattern,
  passwordPattern,
} = require('../../helpers/regExPatterns');
const { checkBirthDate } = require('./validators');

exports.signupValidator = [
  check('firstName')
    .notEmpty()
    .withMessage('FirstName required')
    .isLength({ min: 3 })
    .withMessage('Too short firstName'),

  check('lastName')
    .notEmpty()
    .withMessage('LastName required')
    .isLength({ min: 3 })
    .withMessage('Too short lastName'),

  check('email')
    .notEmpty()
    .withMessage('Email required')
    .matches(emailPattern)
    .withMessage('Invalid email')
    .custom((val) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error('E-mail already in user'));
        }
      }),
    ),

  check('password')
    .notEmpty()
    .withMessage('Password required')
    .matches(passwordPattern)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    )
    .custom((password, { req }) => {
      if (password !== req.body.passwordConfirm) {
        throw new Error('Password Confirmation incorrect');
      }
      return true;
    }),

  check('passwordConfirm')
    .notEmpty()
    .withMessage('Password confirmation required'),

  check('phoneNumber').notEmpty().withMessage('PhoneNumber required'),

  check('DOB')
    .isDate()
    .withMessage('Date of birth required')
    .custom(checkBirthDate('DOB')),

  validatorMiddleware,
];

exports.loginValidator = [
  check('email')
    .notEmpty()
    .withMessage('Email required')
    .matches(emailPattern)
    .withMessage('Invalid email'),

  check('password')
    .notEmpty()
    .withMessage('Password required')
    .matches(passwordPattern)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ),

  validatorMiddleware,
];
