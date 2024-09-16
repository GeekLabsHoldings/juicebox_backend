const { body } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validationMiddleware");

// Validation rules for creating a blog
exports.blogValidationRules = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 10 })
    .withMessage("Title must be at least 10 characters long"),

  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 30 })
    .withMessage("Content must be at least 50 characters long"),

  body("mediaUrl")
    .optional()
    .isURL()
    .withMessage("Invalid media URL"),

  body("spot")
    .optional()
    .isString()
    .withMessage("Spot must be a string"),

  body("status")
    .optional()
    .isIn(["published", "draft"])
    .withMessage("Status must be either 'published' or 'draft'"),

  validatorMiddleware,
]