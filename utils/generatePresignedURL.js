const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3 } = require('../config/awsConfig');

const generatePresignedUrl = async (bucket, key, contentType, expiresIn = 900) => {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(s3, command, { expiresIn });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw new Error('Failed to generate pre-signed URL.');
  }
};

module.exports = generatePresignedUrl;
