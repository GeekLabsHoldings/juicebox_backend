const multer = require("multer");
const ApiError = require("../utils/apiError");
const path = require("path");
const { v4: uuidv4 } = require('uuid');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/cvs'); // Destination folder for CVs
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}-${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

// Multer file filter for PDF only
const fileFilter = (req, file, cb) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === 'application/pdf' && fileExtension === '.pdf') {
    cb(null, true);
  } else {
    cb(new ApiError('Only PDF files are allowed', 400), false);
  }
};

// Multer upload function
const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // Max file size: 2 MB
}).single('cv'); // Single file upload under 'cv' field

module.exports = upload;
