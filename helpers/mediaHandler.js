const { s3 } = require('../config/awsConfig');
const createMulterStorage = require('../middlewares/multerFileMiddleware');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ApiError = require('../utils/apiError');

const handleMedia = (folder, allowedTypes, maxSize) => {
  const upload = createMulterStorage(folder, allowedTypes, maxSize).fields([
    { name: 'mediaUrl', maxCount: 1 }, // Single file for mediaUrl
    { name: 'mediaAllUrls', maxCount: 10 }, // Multiple files for mediaAllUrls
  ]);

  return async (req, res, next) => {
    try {
      upload(req, res, async (err) => {
        if (err) {
          return next(err);
        }

        // Handle single mediaUrl upload for blog
        if (req.files && req.files['mediaUrl']) {
          // Store new file location and key for the blog
          req.body.mediaUrl = req.files['mediaUrl'][0].location;
          req.body.s3Key = req.files['mediaUrl'][0].key;
        }

        // Handle multiple mediaAllUrls uploads for blog
        if (req.files && req.files['mediaAllUrls']) {
          req.body.mediaAllUrls = req.files['mediaAllUrls'].map(file => file.location);
          req.body.s3AllKeys = req.files['mediaAllUrls'].map(file => file.key);
        }

        // // If updating and a new file is uploaded, delete the old blog image (if exists)
        // if (req.method === 'PUT') {
        //   const oldS3Key = req.body.s3Key; 

        //   if (oldS3Key) {
        //     try {
        //       // Delete the old blog image from S3
        //       await s3.send(
        //         new DeleteObjectCommand({
        //           Bucket: process.env.AWS_BUCKET_NAME,
        //           Key: oldS3Key,
        //         })
        //       );
        //       console.log(`Old blog image ${oldS3Key} deleted successfully`);
        //     } catch (deleteErr) {
        //       console.error('Error deleting old blog image:', deleteErr);
        //       return next(new ApiError('Failed to delete old blog image', 500));
        //     }
        //   }
        //   // update the s3Key in the request body
        //   req.body.s3Key = req.body.s3Key;
        // }

        next();
      });
    } catch (err) {
      next(err);
    }
  };
};

const deleteMedia = () => {
  return async (req, res, next) => {
    try {
      // Parse media keys from request body, or set an empty array if no keys are provided
      const mediaKeys = req.body.s3Key ? JSON.parse(req.body.s3Key) : [];

      if (mediaKeys.length) {
        // Use Promise.all to delete all keys in parallel
        await Promise.all(
          mediaKeys.map(async (key) => {
            if (key) {
              try {
                await s3.send(
                  new DeleteObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: key,
                  })
                );
                console.log(`Media file ${key} deleted successfully`);
              } catch (deleteErr) {
                console.error(`Error deleting media file ${key}:`, deleteErr);
                return next(new ApiError('Failed to delete media from storage', 500));
              }
            } else {
              console.warn('No valid key found for deletion');
            }
          })
        );
      } else {
        console.warn('No media keys provided for deletion');
      }
      
      // Proceed to the next middleware, e.g., deleteBlog
      next();
    } catch (err) {
      // Catch any general errors and forward them
      next(err);
    }
  };
};

module.exports = { handleMedia, deleteMedia };
