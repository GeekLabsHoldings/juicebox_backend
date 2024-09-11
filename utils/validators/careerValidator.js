const { body } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validationMiddleware");

// Validation rules for postCareer
exports.careerValidationRules = [
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

// Validation rules for create vacancy
exports.vacancyValidationRules = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 10 })
    .withMessage("Title must be at least 10 characters long"),
  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 50 })
    .withMessage("Description must be at least 50 characters long"),

  body("requirements")
    .notEmpty()
    .withMessage("Requirements is required")
    .isLength({ min: 50 })
    .withMessage("Requirements must be at least 50 characters long"),

  body("benefits")
    .notEmpty()
    .withMessage("Benefits is required")
    .isLength({ min: 50 })
    .withMessage("Benefits must be at least 50 characters long"),

  body("responsibilities")
    .notEmpty()
    .withMessage("Responsibilities is required")
    .isLength({ min: 50 })
    .withMessage("Responsibilities must be at least 50 characters long"),

  body("status")
    .isIn(["open", "closed"])
    .withMessage("Status must be open or closed"),

  validatorMiddleware,  
];
