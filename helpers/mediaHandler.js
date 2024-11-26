const { s3 } = require('../config/awsConfig');
const createMulterStorage = require('../middlewares/multerFileMiddleware');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ApiError = require('../utils/apiError');

const handleMedia = (folder, allowedTypes, maxSize) => {
  const upload = createMulterStorage(folder, allowedTypes, maxSize).fields([
    { name: 'mediaUrl', maxCount: 1 }, // Single file for mediaUrl
    { name: 'mediaUrls', maxCount: 10 }, // Multiple files for mediaUrls
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

        // Handle multiple mediaUrls uploads for blog
        if (req.files && req.files['mediaUrls']) {
          req.body.mediaUrls = req.files['mediaUrls'].map(file => file.location);
          req.body.s3Keys = req.files['mediaUrls'].map(file => file.key);
        }

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
      const mediaKeys = req.body.s3Key ? [req.body.s3Key] : [];
      
      if (req.body.s3Keys) {
        mediaKeys.push(...req.body.s3Keys);
      }

      if (mediaKeys.length) {
        await Promise.all(
          mediaKeys.map(async (key) => {
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
          })
        );
      } else {
        console.warn('No media keys provided for deletion');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { handleMedia, deleteMedia };

// const { s3 } = require('../config/awsConfig');
// const createMulterStorage = require('../middlewares/multerFileMiddleware');
// const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
// const ApiError = require('../utils/apiError');

// const handleMedia = (folder, allowedTypes, maxSize) => {
//   const upload = createMulterStorage(folder, allowedTypes, maxSize).fields([
//     { name: 'mediaUrl', maxCount: 1 },
//     { name: 'mediaAllUrls', maxCount: 10 },
//   ]);

//   return async (req, res, next) => {
//     try {
//       upload(req, res, async (err) => {
//         if (err) return next(err);

//         // Store new file information
//         if (req.files && req.files['mediaUrl']) {
//           req.body.mediaUrl = req.files['mediaUrl'][0].location;
//           req.body.s3Key = req.files['mediaUrl'][0].key;
//         }
//         if (req.files && req.files['mediaAllUrls']) {
//           req.body.mediaAllUrls = req.files['mediaAllUrls'].map(file => file.location);
//           req.body.s3AllKeys = req.files['mediaAllUrls'].map(file => file.key);
//         }

//         // Handle old S3 key deletion when updating
//         if (req.method === 'PUT') {
//           const oldS3Key = req.body.oldS3Key; // Assume old S3 keys are sent as `oldS3Key`

//           if (oldS3Key && oldS3Key !== req.body.s3Key) { // Ensure new key is not deleted
//             try {
//               await s3.send(
//                 new DeleteObjectCommand({
//                   Bucket: process.env.AWS_BUCKET_NAME,
//                   Key: oldS3Key,
//                 })
//               );
//               console.log(`Old media ${oldS3Key} deleted successfully`);
//             } catch (deleteErr) {
//               console.error('Error deleting old media:', deleteErr);
//               return next(new ApiError('Failed to delete old media', 500));
//             }
//           }
//         }

//         next();
//       });
//     } catch (err) {
//       next(err);
//     }
//   };
// };

// const deleteMedia = () => {
//   return async (req, res, next) => {
//     try {
//       const mediaKeys = req.body.s3Key ? [req.body.s3Key] : [];
      
//       if (req.body.s3AllKeys) {
//         mediaKeys.push(...req.body.s3AllKeys);
//       }

//       if (mediaKeys.length) {
//         await Promise.all(
//           mediaKeys.map(async (key) => {
//             try {
//               await s3.send(
//                 new DeleteObjectCommand({
//                   Bucket: process.env.AWS_BUCKET_NAME,
//                   Key: key,
//                 })
//               );
//               console.log(`Media file ${key} deleted successfully`);
//             } catch (deleteErr) {
//               console.error(`Error deleting media file ${key}:`, deleteErr);
//               return next(new ApiError('Failed to delete media from storage', 500));
//             }
//           })
//         );
//       } else {
//         console.warn('No media keys provided for deletion');
//       }

//       next();
//     } catch (err) {
//       next(err);
//     }
//   };
// };

// module.exports = { handleMedia, deleteMedia };

