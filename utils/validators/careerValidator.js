const { body } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validationMiddleware");

// Validation rules for postCareer
const careerValidationRules = [
  body("vacancyId").isMongoId().withMessage("Invalid vacancy ID"),
  body("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .isAlpha()
    .withMessage("First name must contain only letters"),
  body("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .isAlpha()
    .withMessage("Last name must contain only letters"),
  body("email").isEmail().withMessage("Invalid email address"),
  body("phoneNumber")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid phone number"),
  body("linkedInLink").optional().isURL().withMessage("Invalid LinkedIn URL"),
  body("portfolioLink").optional().isURL().withMessage("Invalid portfolio URL"),

  validatorMiddleware,
];

module.exports = { careerValidationRules };
