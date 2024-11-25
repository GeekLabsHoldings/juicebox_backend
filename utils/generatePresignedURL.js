const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3 } = require('../config/awsConfig');

/**
 * Generates a pre-signed URL for uploading files to S3
 * @param {string} bucket - Name of the S3 bucket
 * @param {string} key - Key (path) where the file will be uploaded
 * @param {string} contentType - MIME type of the file
 * @param {number} expiresIn - Expiration time in seconds (default: 15 minutes)
 * @returns {Promise<string>} Pre-signed URL
 */
const generatePresignedUrl = async (bucket, key, contentType, expiresIn = 900) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3, command, { expiresIn });
};

module.exports = generatePresignedUrl;
