const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const { v4: uuidv4 } = require('uuid');
const generatePresignedUrl = require('../utils/generatePresignedURL');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Handles requests to generate pre-signed upload URLs for multiple files.
 */
exports.getUploadUrl = catchError(asyncHandler(async (req, res) => {
  
    const { folder, files } = req.body;

    // Validate input
    if (!folder) {
      throw new ApiError('"folder" parameter is required.', 400);
    }
    if (!Array.isArray(files) || files.length === 0) {
      throw new ApiError('"files" parameter must be a non-empty array.', 400);
    }

    const bucketName = process.env.AWS_BUCKET_NAME;

    // Generate pre-signed URLs in parallel
    const uploadUrls = await Promise.all(
      files.map(async (file) => {
        const { fileName, contentType } = file;

        if (!fileName || !contentType) {
          throw new ApiError(
            'Each file object must include "fileName" and "contentType".',
            400
          );
        }

        const uniqueFileName = `${uuidv4()}_${fileName}`;
        const key = `${folder}/${uniqueFileName}`;
        const uploadUrl = await generatePresignedUrl(bucketName, key, contentType);

        return { uploadUrl, key };
      })
    );

    // Send success response
    res.status(200).json(
      new ApiResponse(200, { uploadUrls }, 'Pre-signed URLs generated successfully')
    );
  })
);
