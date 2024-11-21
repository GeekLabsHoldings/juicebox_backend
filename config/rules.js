const redis = require('./ioredis');

module.exports = {
  requestLimits: {
    globalRequestLimit: 2000,
    userRequestLimit: 100,
    timeWindow: 60, // seconds
  },
  blocking: {
    baseBlockDuration: 10 * 60, // 10 minutes
    maxBlockDuration: 7 * 24 * 60 * 60, // 7 days
  },
  botDetection: {
    suspiciousUserAgentPatterns: [/bot|crawler|spider|headless/i],
    customBotIPs: async () => await redis.smembers('customBotIPs'),
  },
  honeypot: {
    fakeEndpoints: ['/trap-api', '/forbidden/secret'],
    decoyAssets: ['/fake.js', '/bait.png'],
    fakeResponseText: 'Access forbidden.',
    permanentBlockThreshold: 3,
  },
  failSafe: {
    maxAllowedRequests: 1000,
    duration: 300, // seconds
    globalFailSafeAction: async () => {
      const logger = require('../utils/logger')('failSafe.log');
      logger.warn('Fail-safe activated. Redirecting traffic.');
      await redis.set('globalFailSafeActive', true, 'EX', 660);
    },
  },
  whitelistedIPs: async () => await redis.smembers('whitelistedIPs'),
};
