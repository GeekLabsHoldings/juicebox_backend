const { s3 } = require('../config/awsConfig');
const createMulterStorage = require('../middlewares/multerFileMiddleware');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ApiError = require('../utils/apiError');

// Unified media handler for upload, update, and delete operations
const handleMedia = (folder, fieldName, allowedTypes, maxSize) => {
  const upload = createMulterStorage(folder, allowedTypes, maxSize).single(
    fieldName,
  );

  return async (req, res, next) => {
    try {
      // Handle file upload
      upload(req, res, async (err) => {
        if (err) {
          return next(err);
        }

        // If new file uploaded, handle old file deletion for update
        if (req.file && req.file.location && req.method === 'PUT') {
          const mediaKey = req.body.s3Key;

          if (mediaKey) {
            try {
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: mediaKey,
                }),
              );
            } catch (deleteErr) {
              console.error('Error deleting old media:', deleteErr);
              return next(new ApiError('Failed to delete old media', 500));
            }
          }

          // Add the new file's URL and S3 key to the request body
          req.body[fieldName] = req.file.location;
          req.body.s3Key = req.file.key; // Store the new S3 key
        }

        // For create, add the media URL and S3 key to the request body
        if (req.file && req.file.location && req.method === 'POST') {
          req.body[fieldName] = req.file.location;
          req.body.s3Key = req.file.key; // Store the new S3 key
        }

        next();
      });
    } catch (err) {
      next(err);
    }
  };
};

// Middleware for delete operation
const deleteMedia = (folder, fieldName) => {
  return async (req, res, next) => {
    try {
      const mediaKey = req.body.s3Key;
      if (mediaKey) {
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: mediaKey,
            }),
          );
          console.log(`Media file ${mediaKey} deleted successfully`);
        } catch (deleteErr) {
          console.error('Error deleting media from S3:', deleteErr);
          return next(new ApiError('Failed to delete media from storage', 500));
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { handleMedia, deleteMedia };
