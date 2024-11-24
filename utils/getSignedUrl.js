const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Generates a presigned URL for uploading an object to an S3 bucket.
 * 
 * @param {string} key - The key or name of the object to be uploaded.
 * @param {string} bucket - The name of the S3 bucket.
 * @param {number} [expiresIn=3600] - The duration in seconds for which the presigned URL is valid.
 * @returns {Promise<string>} - A promise that resolves to the presigned URL.
 * @throws Will throw an error if URL generation fails.
 */
const generatePresignedUrl = async (key, bucket, expiresIn = 3600) => {
  try {
    // Create a command to put an object in the specified S3 bucket
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ACL: 'public-read', // Set object access to public-read
    });

    // Generate the presigned URL using the command and specified expiry
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    // Log and throw an error if URL generation fails
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

module.exports = { generatePresignedUrl };
