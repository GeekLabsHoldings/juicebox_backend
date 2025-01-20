const asyncHandler = require('express-async-handler');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3 } = require('../config/awsConfig');

const generatePresignedUrl = catchError(
  asyncHandler(async (bucket, key, contentType, expiresIn = 900) => {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(s3, command, { expiresIn });
  }),
);

module.exports = generatePresignedUrl;
