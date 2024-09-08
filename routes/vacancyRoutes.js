const express = require("express");
const { getAllVacancies, postCareer } = require("../controllers/vacanciesController");
const upload = require('../helpers/pdfFilesUploader');
const { careerValidationRules } = require("../utils/validators/careerValidator");

const router = express.Router();

router.get("/get-all-vacancies", getAllVacancies);
router.post("/add-career", upload, careerValidationRules, postCareer);

module.exports = router;
