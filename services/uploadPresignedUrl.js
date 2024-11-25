const { v4: uuidv4 } = require('uuid');
const generatePresignedUrl = require('../utils/generatePresignedURL');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Handles requests to generate pre-signed upload URLs for multiple files.
 */
exports.getUploadUrl = async (req, res, next) => {
  try {
    const { files } = req.body;

    // Validate input
    if (!Array.isArray(files) || files.length === 0) {
      throw new ApiError('Invalid "files" parameter. Provide an array of file objects.', 400);
    }

    const bucketName = process.env.AWS_BUCKET_NAME;

    // Generate presigned URLs in parallel
    const uploadUrls = await Promise.all(
      files.map(async (file) => {
        const { folder, fileName, contentType } = file;

        // Validate file details
        if (!folder || !fileName || !contentType) {
          throw new ApiError(
            'Each file object must include "folder", "fileName", and "contentType".',
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
  } catch (error) {
    next(error);
  }
};
