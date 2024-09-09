const { createAwsClient } = require('../utils/awsUtils');
const { S3Client } = require('@aws-sdk/client-s3');
const { Route53DomainsClient } = require('@aws-sdk/client-route-53-domains');

const s3 = createAwsClient(S3Client);
const route53 = createAwsClient(Route53DomainsClient);

module.exports = { s3, route53 };
