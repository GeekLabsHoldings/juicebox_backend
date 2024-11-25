const redis = require('./ioredis');

module.exports = {
  requestLimits: {
    globalRequestLimit: 2000,
    userRequestLimit: 100,
    timeWindow: 60, // seconds
    burstLimit: 50,
    burstWindow: 10, // seconds
    rateAdjustmentFactor: 1.2,
  },
  blocking: {
    baseBlockDuration: 10 * 60, // 10 minutes
    maxBlockDuration: 7 * 24 * 60 * 60, // 7 days
    escalationFactor: 2,
    blockDecayRate: 0.33, // Reduce block duration daily by 33%
  },
  botDetection: {
    suspiciousUserAgentPatterns: [
      /bot|crawler|spider|scraper|headless|selenium|phantomjs/i,
    ],
    logUnknownUserAgents: true,
    customBotIPs: async () => redis.smembers('customBotIPs'),
  },
  honeypot: {
    enabled: true,
    fakeEndpoints: ['/trap-api', '/forbidden/secret'],
    hiddenFieldName: () => `fake_field_${Math.random().toString(36).slice(2)}`,
    decoyAssets: ['/fake.js', '/bait.png'],
    fakeResponseText: 'Access forbidden.',
    permanentBlockThreshold: 3,
  },
  failSafe: {
    enabled: true,
    maxAllowedRequests: 1000,
    duration: 300, // seconds
    globalFailSafeAction: async () => {
      logger.warn('Activating fail-safe. Redirecting traffic.');
      await redis.set('globalFailSafeActive', true, 'EX', 660);
    },
  },
  whitelistedIPs: async () => redis.smembers('whitelistedIPs'),
  rateLimiter: {
    keyPrefix: 'rate-limit',
    points: 20, // Allowed requests per window
    duration: 10, // Window duration in seconds
    warningThreshold: 10,
    baseTemporaryBlockDuration: 10 * 60, // 10 minutes
    escalationFactor: 1.5,
    decayTime: 30 * 60, // Reset offenses after 30 minutes
  },
};
