const multer = require('multer');
const DataUriParser = require('datauri/parser.js');
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({ storage });
const parser = new DataUriParser();

const formatImage = (file) => {
  const fileExtension = path.extname(file.originalname).toString();
  return parser.format(fileExtension, file.buffer).content;
};

module.exports = { upload, formatImage };
