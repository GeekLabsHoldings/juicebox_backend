const { s3 } = require('../config/awsConfig');
const createMulterStorage = require('../middlewares/multerFileMiddleware');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Unified media handler for upload, update, and delete operations
const handleMedia = (folder, fieldName, allowedTypes, maxSize) => {
  const upload = createMulterStorage(folder, allowedTypes, maxSize).single(fieldName);

  return async (req, res, next) => {
    try {
      // Handle file upload
      upload(req, res, async (err) => {
        if (err) {
          return next(err);
        }

        // If new file uploaded, handle old file deletion for update
        if (req.file && req.file.location && req.method === 'PUT') {
          const mediaKey = req.body[fieldName]?.split('/').pop(); // Extract the old file's key
          
          if (mediaKey) {
            try {
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: `${folder}/${mediaKey}`,
                })
              );
            } catch (deleteErr) {
              console.error('Error deleting old media:', deleteErr);
              return next(new ApiError('Failed to delete old media', 500));
            }
          }

          // Add the new file's URL to the request body
          req.body[fieldName] = req.file.location;
        }

        // For create, add the media URL to the request body
        if (req.file && req.file.location && req.method === 'POST') {
          req.body[fieldName] = req.file.location;
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
      const mediaKey = req.body[fieldName]?.split('/').pop();
      if (mediaKey) {
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: `${folder}/${mediaKey}`,
            })
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
