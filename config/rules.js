const redis = require('./ioredis');

module.exports = {
  requestLimits: {
    globalRequestLimit: 2000,
    userRequestLimit: 100,
    timeWindow: 60,
    burstLimit: 50,
    burstWindow: 10,
    rateAdjustmentFactor: 1.2,
  },
  blocking: {
    baseBlockDuration: 10 * 60,
    maxBlockDuration: 7 * 24 * 60 * 60,
    escalationFactor: 2,
    blockDecayRate: 0.33,
  },
  botDetection: {
    suspiciousUserAgentPatterns: [
      /bot|crawler|spider|scraper|headless|selenium|phantomjs/i,
    ],
    logUnknownUserAgents: true,
    customBotIPs: async () => await redis.smembers('customBotIPs'),
  },
  honeypot: {
    enabled: true,
    fakeEndpoints: ['/trap-api', '/forbidden/secret'],
    hiddenFieldName: () =>
      `fake_field_${Math.random().toString(36).slice(2)}`,
    decoyAssets: ['/fake.js', '/bait.png'],
    fakeResponseText: 'Access forbidden.',
    permanentBlockThreshold: 3,
  },
  failSafe: {
    enabled: true,
    maxAllowedRequests: 1000,
    duration: 300,
    globalFailSafeAction: async () => {
      console.warn('Activating fail-safe. Redirecting traffic.');
      await redis.set('globalFailSafeActive', true, 'EX', 660);
    },
  },
  whitelistedIPs: async () => await redis.smembers('whitelistedIPs'),
  rateLimiter: {
    keyPrefix: 'rate-limit',
    points: 20,
    duration: 10,
    warningThreshold: 10,
    baseTemporaryBlockDuration: 10 * 60,
    escalationFactor: 1.5,
    decayTime: 30 * 60,
  },
};
