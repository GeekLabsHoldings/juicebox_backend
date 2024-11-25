const generatePresignedUrl = require('../utils/generatePresignedURL');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

exports.getUploadUrl = async (req, res, next) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new ApiError('Missing or invalid "files" parameter. Expected an array of file details.', 400);
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    const uploadUrls = [];

    for (const file of files) {
      const { folder, fileName, contentType } = file;

      if (!folder || !fileName || !contentType) {
        throw new ApiError(
          'Each file object must contain "folder", "fileName", and "contentType".',
          400
        );
      }

      const key = `${folder}/${fileName}`; // Construct the file path in the bucket
      const uploadUrl = await generatePresignedUrl(bucketName, key, contentType);

      uploadUrls.push({ uploadUrl, key });
    }

    res.status(200).json(
      new ApiResponse(200, { uploadUrls }, 'Pre-signed URLs generated successfully')
    );
  } catch (error) {
    next(error);
  }
};
