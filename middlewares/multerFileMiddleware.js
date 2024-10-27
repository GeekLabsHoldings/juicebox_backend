const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3 } = require('../config/awsConfig');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const ApiError = require('../utils/apiError');

// Function to create multer storage configuration
const createMulterStorage = (folder, allowedTypes, maxSize) => {
  const fileFilter = (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    if (allowedTypes.includes(mimeType) && allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new ApiError(`Only ${allowedTypes.join(', ')} files are allowed`, 400), false);
    }
  };

  const storage = multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}-${Date.now()}${ext}`;
      cb(null, `${folder}/${uniqueFilename}`);
    },
    contentType: (req, file, cb) => {
      cb(null, file.mimetype);
    },
    acl: 'public-read',
  });

  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: maxSize }, // Maximum file size in bytes
  });
};

module.exports = createMulterStorage;

// const multer = require('multer');
// const multerS3 = require('multer-s3');
// const { s3 } = require('../config/awsConfig');
// const { v4: uuidv4 } = require('uuid');
// const path = require('path');
// const ApiError = require('../utils/apiError');

// // Function to create multer storage configuration
// const createMulterStorage = (folder, allowedMimeTypes, allowedExtensions, maxSize) => {
//   const fileFilter = (req, file, cb) => {
//     const fileExtension = path.extname(file.originalname).toLowerCase();
//     const mimeType = file.mimetype;

//     // Check if the MIME type is allowed
//     if (allowedMimeTypes.includes(mimeType) && allowedExtensions.includes(fileExtension)) {
//       cb(null, true);
//     } else {
//       cb(
//         new ApiError(
//           `Only files with extensions ${allowedExtensions.join(', ')} and MIME types ${allowedMimeTypes.join(', ')} are allowed`,
//           400
//         ),
//         false
//       );
//     }
//   };

//   const storage = multerS3({
//     s3: s3,
//     bucket: process.env.AWS_BUCKET_NAME,
//     metadata: (req, file, cb) => {
//       cb(null, { fieldName: file.fieldname });
//     },
//     key: (req, file, cb) => {
//       const ext = path.extname(file.originalname);
//       const uniqueFilename = `${uuidv4()}-${Date.now()}${ext}`;
//       cb(null, `${folder}/${uniqueFilename}`);
//     },
//     acl: 'public-read-write',
//   });

//   return multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: { fileSize: maxSize }, // Maximum file size in bytes
//   });
// };

// module.exports = createMulterStorage;

