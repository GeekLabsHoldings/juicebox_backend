const express = require("express");
const {
  getAllVacancies,
  postCareer,
} = require("../controllers/vacanciesController");
const createMulterStorage = require("../middlewares/multerFileMiddleware");
const {
  careerValidationRules,
} = require("../utils/validators/careerValidator");

// Create upload configuration for PDFs
const uploadPDF = createMulterStorage(
  "cvs",
  ["application/pdf", ".pdf"],
  5 * 1024 * 1024
); // 5 MB max size

const router = express.Router();

router.get("/get-all-vacancies", getAllVacancies);
router.post(
  "/add-career",
  uploadPDF.single("cv"),
  careerValidationRules,
  postCareer
);

module.exports = router;
