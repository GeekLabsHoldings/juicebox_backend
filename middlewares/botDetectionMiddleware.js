const redis = require('../config/ioredis');
const { createLogger } = require('../utils/logger');
const { getClientIp } = require('request-ip');

const logger = createLogger();

const RULES = {
  blocking: {
    baseBlockDuration: 10 * 60, // 10 minutes
    maxBlockDuration: 7 * 24 * 60 * 60, // 7 days
  },
  botDetection: {
    suspiciousUserAgentPatterns: [
      /bot|crawler|spider|scraper|headless|selenium|phantomjs/i,
    ],
    customBotIPs: async () => redis.smembers('customBotIPs'),
  },
  honeypot: {
    fakeEndpoints: ['/trap-api', '/forbidden/secret'],
    decoyAssets: ['/fake.js', '/bait.png'],
  },
  whitelistedIPs: async () => redis.smembers('whitelistedIPs'),
};

// Utility: Calculate Block Duration
const calculateBlockDuration = (abuseScore) => {
  const { baseBlockDuration, maxBlockDuration } = RULES.blocking;

  // Scale block time between base and max based on abuse score (0–100)
  const scaledDuration =
    baseBlockDuration +
    ((maxBlockDuration - baseBlockDuration) * abuseScore) / 100;

  return Math.min(scaledDuration, maxBlockDuration); // Cap at maxBlockDuration
};

// Utility: Check IP Reputation
const checkIPReputation = async (ip) => {
  try {
    const whitelistedIPs = await RULES.whitelistedIPs();
    if (whitelistedIPs.includes(ip)) return false;

    const ipData = JSON.parse((await redis.get(`ipReputation:${ip}`)) || '{}');
    return ipData.abuseScore || 0; // Return abuse score (default to 0)
  } catch (err) {
    logger.error('[ERROR] Check IP Reputation:', err.message);
    return 0;
  }
};

// Utility: Update IP Reputation
const updateIPReputation = async (ip, event) => {
  const ipData = JSON.parse((await redis.get(`ipReputation:${ip}`)) || '{}');
  const currentScore = ipData.abuseScore || 0;

  // Increment score based on the event type
  const increment =
    event === 'honeypot'
      ? 20
      : event === 'bot'
        ? 30
        : event === 'malicious'
          ? 10
          : 0;
  const newScore = Math.min(currentScore + increment, 100); // Cap at 100

  await redis.set(
    `ipReputation:${ip}`,
    JSON.stringify({
      abuseScore: newScore,
      reportCount: (ipData.reportCount || 0) + 1,
      lastReported: new Date().toISOString(),
    }),
    'EX',
    RULES.blocking.maxBlockDuration,
  );

  return newScore;
};

// Middleware: Enhanced Bot Detection
const enhancedBotDetection = async (req, res, next) => {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const isBot = RULES.botDetection.suspiciousUserAgentPatterns.some(
      (pattern) => pattern.test(userAgent),
    );

    const abuseScore = await checkIPReputation(ip);

    if (isBot || abuseScore >= 50) {
      const newScore = await updateIPReputation(
        ip,
        isBot ? 'bot' : 'malicious',
      );

      // Dynamically calculate block duration
      const blockDuration = calculateBlockDuration(newScore);

      await redis.set(
        `block:${ip}`,
        true,
        'EX',
        Math.ceil(blockDuration / 1000),
      );
      logger.warn(
        `Blocked IP: ${ip} for ${Math.ceil(blockDuration / 60)} minutes`,
      );

      return res.status(403).json({
        message: `Access denied due to malicious activity. Blocked for ${Math.ceil(
          blockDuration / 60,
        )} minutes.`,
      });
    }

    next();
  } catch (err) {
    logger.error('[ERROR] Enhanced Bot Detection:', err.message);
    res.status(503).send('Service unavailable.');
  }
};

// Middleware: Honeypot Detection
const honeypot = async (req, res, next) => {
  const ip = getClientIp(req);

  try {
    const isHoneypotTrigger =
      RULES.honeypot.fakeEndpoints.includes(req.path) ||
      RULES.honeypot.decoyAssets.some((asset) => req.path.includes(asset));

    if (isHoneypotTrigger) {
      const newScore = await updateIPReputation(ip, 'honeypot');

      // Dynamically calculate block duration
      const blockDuration = calculateBlockDuration(newScore);

      await redis.set(
        `block:${ip}`,
        true,
        'EX',
        Math.ceil(blockDuration / 1000),
      );
      logger.warn(
        `Honeypot triggered. Blocked IP: ${ip} for ${Math.ceil(blockDuration / 60)} minutes`,
      );

      return res.status(403).json({
        message: 'Access forbidden.',
      });
    }

    next();
  } catch (err) {
    logger.error('[ERROR] Honeypot Detection:', err.message);
    next();
  }
};

module.exports = { enhancedBotDetection, honeypot };

// const redis = require('../config/ioredis');
// const fetch = require('node-fetch');
// const { createLogger } = require('../utils/logger');
// const { getClientIp } = require('request-ip');

// // Create a logger instance for this module
// const logger = createLogger();

// // Rules Configuration
// const RULES = {
//   requestLimits: {
//     globalRequestLimit: 2000,
//     userRequestLimit: 100,
//     timeWindow: 60, // seconds
//     burstLimit: 50,
//     burstWindow: 10, // seconds
//     rateAdjustmentFactor: 1.2,
//   },
//   blocking: {
//     baseBlockDuration: 10 * 60, // 10 minutes
//     maxBlockDuration: 7 * 24 * 60 * 60, // 7 days
//     escalationFactor: 2,
//     blockDecayRate: 0.33, // Reduce block duration daily by 33%
//   },
//   botDetection: {
//     suspiciousUserAgentPatterns: [
//       /bot|crawler|spider|scraper|headless|selenium|phantomjs/i,
//     ],
//     logUnknownUserAgents: true,
//     customBotIPs: async () => redis.smembers('customBotIPs'),
//   },
//   honeypot: {
//     enabled: true,
//     fakeEndpoints: ['/trap-api', '/forbidden/secret'],
//     hiddenFieldName: () => `fake_field_${Math.random().toString(36).slice(2)}`,
//     decoyAssets: ['/fake.js', '/bait.png'],
//     fakeResponseText: 'Access forbidden.',
//     permanentBlockThreshold: 3,
//   },
//   failSafe: {
//     enabled: true,
//     maxAllowedRequests: 1000,
//     duration: 300, // seconds
//     globalFailSafeAction: async () => {
//       logger.warn('Activating fail-safe. Redirecting traffic.');
//       await redis.set('globalFailSafeActive', true, 'EX', 660);
//     },
//   },
//   whitelistedIPs: async () => redis.smembers('whitelistedIPs'),
// };

// // Utility: Log Activity
// const logActivity = async (type, details) => {
//   logger.info({ type, details, timestamp: new Date() });
// };

// // Utility: Check IP Reputation
// const checkIPReputation = async (ip) => {
//   try {
//     if (!process.env.ABUSEIPDB_API_KEY) {
//       logger.warn('AbuseIPDB API key is not set.');
//       return false;
//     }

//     const response = await fetch(
//       `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`,
//       {
//         headers: {
//           Key: process.env.ABUSEIPDB_API_KEY,
//           Accept: 'application/json',
//         },
//       },
//     );

//     if (!response.ok) {
//       throw new Error(
//         `AbuseIPDB request failed with status: ${response.status}`,
//       );
//     }

//     const reputation = await response.json();
//     return reputation?.data?.abuseConfidenceScore >= 50;
//   } catch (err) {
//     logger.error('[ERROR] IP Reputation Check:', err.message);
//     return false;
//   }
// };

// // Middleware: Enhanced Bot Detection
// const enhancedBotDetection = async (req, res, next) => {
//   const ip = getClientIp(req);
//   const userAgentString = req.headers['user-agent'] || 'unknown';
//   const now = Date.now();
//   const blockKey = `bot_block:${ip}`;

//   try {
//     const blockStatus = await redis.get(blockKey);
//     if (blockStatus) {
//       const remainingTime = Math.ceil((parseInt(blockStatus) - now) / 1000);
//       res.setHeader('Retry-After', remainingTime);
//       return res
//         .status(403)
//         .json({ message: `Blocked. Retry after ${remainingTime} seconds.` });
//     }

//     const isBot = RULES.botDetection.suspiciousUserAgentPatterns.some(
//       (pattern) => pattern.test(userAgentString),
//     );

//     const isMaliciousIP = await checkIPReputation(ip);

//     if (isBot || isMaliciousIP) {
//       const blockDuration = RULES.blocking.baseBlockDuration;
//       await redis.set(
//         blockKey,
//         now + blockDuration * 1000,
//         'EX',
//         blockDuration,
//       );

//       await logActivity('BOT_DETECTION', { ip, userAgent: userAgentString });
//       return res.status(403).json({ message: 'Bot detected. Access denied.' });
//     }

//     next();
//   } catch (err) {
//     logger.error('[ERROR] Enhanced Bot Detection:', err.message);
//     return res.status(503).send('Service unavailable.');
//   }
// };

// // Middleware: Honeypot Detection
// const honeypot = async (req, res, next) => {
//   const ip = getClientIp(req);
//   const redisKey = `honeypot:${ip}`;

//   try {
//     const whitelistedIPs = await RULES.whitelistedIPs();
//     if (whitelistedIPs.includes(ip)) return next();

//     const isHoneypotTrigger =
//       RULES.honeypot.fakeEndpoints.includes(req.path) ||
//       RULES.honeypot.decoyAssets.some((asset) => req.path.includes(asset));

//     if (isHoneypotTrigger) {
//       const honeypotInfo = JSON.parse((await redis.get(redisKey)) || '{}');
//       honeypotInfo.triggers = (honeypotInfo.triggers || 0) + 1;

//       if (honeypotInfo.triggers >= RULES.honeypot.permanentBlockThreshold) {
//         await redis.set(
//           redisKey,
//           JSON.stringify(honeypotInfo),
//           'EX',
//           RULES.blocking.maxBlockDuration,
//         );
//         return res
//           .status(403)
//           .json({ message: 'Permanently blocked due to honeypot triggers.' });
//       }

//       const blockDuration =
//         honeypotInfo.triggers * RULES.blocking.baseBlockDuration;
//       await redis.set(
//         redisKey,
//         JSON.stringify(honeypotInfo),
//         'EX',
//         blockDuration,
//       );
//       return res.status(403).json({ message: RULES.honeypot.fakeResponseText });
//     }

//     next();
//   } catch (err) {
//     logger.error('[ERROR] Honeypot Detection:', err);
//     next();
//   }
// };

// // Middleware: Fail-Safe Mechanism
// const failSafe = async (req, res, next) => {
//   try {
//     const failSafeStatus = await redis.get('globalFailSafeActive');
//     if (failSafeStatus) {
//       return res
//         .status(503)
//         .json({ message: 'Service temporarily unavailable.' });
//     }

//     const requestCount = await redis.incr('globalRequestCount');
//     if (requestCount === 1) {
//       await redis.expire('globalRequestCount', RULES.failSafe.duration);
//     }

//     if (requestCount > RULES.failSafe.maxAllowedRequests) {
//       await RULES.failSafe.globalFailSafeAction();
//       return res
//         .status(503)
//         .json({ message: 'Service temporarily unavailable.' });
//     }

//     next();
//   } catch (err) {
//     logger.error('[ERROR] Fail-Safe Mechanism:', err);
//     next();
//   }
// };

// // Export Middleware
// module.exports = { enhancedBotDetection, honeypot, failSafe };
